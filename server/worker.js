import { Worker } from "bullmq";

import { QdrantVectorStore } from "@langchain/qdrant";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { HuggingFaceTransformersEmbeddings }
from "@langchain/community/embeddings/huggingface_transformers";

console.log("Starting Worker...");

const worker = new Worker(

  "file-upload-queue",

  async (job) => {

    try {

      console.log("=================================");
      console.log("🚀 New Job Received at:", new Date().toISOString());
      console.log("Job ID:", job.id);
      console.log("Job Data:", job.data);
      console.log("=================================");

      // const data =
      //   typeof job.data === "string"
      //     ? JSON.parse(job.data)
      //     : job.data;

      const data = job.data;

      console.log("Loading PDF...");

      const loader = new PDFLoader(data.path);

      const docs = await loader.load();

      console.log("PDF Loaded Successfully");
      console.log("Total Pages:", docs.length);

      console.log("Creating Text Splitter...");

      const textSplitter =
        new RecursiveCharacterTextSplitter({
          chunkSize: 1000,
          chunkOverlap: 200,
        });

      console.log("Splitting Documents...");

      const chunks =
        await textSplitter.splitDocuments(docs);

      console.log("Chunks Created Successfully");
      console.log("Total Chunks:", chunks.length);

      if (chunks.length > 0) {
        console.log("First Chunk Preview:");
        console.log(
          chunks[0].pageContent.slice(0, 200)
        );
      }

      console.log("Loading Embedding Model...");

      const embeddings =
      new HuggingFaceTransformersEmbeddings({
      model: "Xenova/all-MiniLM-L6-v2",
      });
      console.log("Embedding Model Loaded");

      console.log("Connecting to Qdrant...");

      console.log("Creating Collection + Inserting Vectors...");

      await QdrantVectorStore.fromDocuments(
        chunks,
        embeddings,
        {
          url: "http://localhost:6333",
          collectionName: "pdf-collection",
        }
      );

      console.log("=================================");
      console.log("Vectors Stored Successfully");
      console.log(
        `Inserted ${chunks.length} chunks`
      );
      console.log("=================================");

    } catch (err) {

      console.error("=================================");
      console.error("WORKER ERROR");
      console.error(err);
      console.error("=================================");

    }
  },

  {
    connection: {
      host: "127.0.0.1",
      port: 6379,
    },

    concurrency: 100,
  }
);

worker.on("ready", () => {
  console.log("✅ Worker is ready and listening for jobs...");
});

worker.on("active", (job) => {
  console.log(`🔄 Job ${job.id} is now active`);
});

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.log(`❌ Job ${job?.id} failed`);
  console.error("Error Details:", err);
});

worker.on("error", (err) => {
  console.error("❌ Worker Error:", err);
});

console.log("Worker Started Successfully");