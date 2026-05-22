import express from "express";
import cors from "cors";
import multer from "multer";


import { Queue } from "bullmq";

import { QdrantVectorStore }
from "@langchain/qdrant";

import { HuggingFaceTransformersEmbeddings }
from "@langchain/community/embeddings/huggingface_transformers";

import { GoogleGenerativeAI }
from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();


const app = express();

app.use(cors());

/* ================================
   GEMINI CONFIG
================================ */

const genAI =
  new GoogleGenerativeAI(
   process.env.GEMINI_API_KEY
  );

/* ================================
   REDIS / BULLMQ QUEUE
================================ */

const queue = new Queue(
  "file-upload-queue",
  {
    connection: {
      host: "127.0.0.1",
      port: 6379,
    },
  }
);

/* ================================
   MULTER STORAGE CONFIG
================================ */

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },

  filename: function (req, file, cb) {

    const uniqueSuffix =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      `${uniqueSuffix}-${file.originalname}`
    );
  },
});

const upload = multer({
  storage,
});

/* ================================
   ROOT ROUTE
================================ */

app.get("/", (req, res) => {

  return res.json({
    success: true,
    status: "Server Running",
  });

});

/* ================================
   PDF UPLOAD ROUTE
================================ */

app.post(
  "/upload/pdf",

  upload.single("pdf"),

  async (req, res) => {

    try {

      console.log(
        "📄 PDF Upload Request Received"
      );

      console.log(req.file);

      await queue.add(
        "file-ready",
        {
          filename:
            req.file.originalname,

          destination:
            req.file.destination,

          path:
            req.file.path,
        }
      );

      console.log(
        "✅ Job Added To Queue"
      );

      return res.json({
        success: true,
        message:
          "File uploaded successfully",
      });

    } catch (err) {

      console.error(
        "❌ Upload Error:",
        err
      );

      return res.status(500).json({
        success: false,
        error: err.message,
      });

    }
  }
);

/* ================================
   CHAT ROUTE
================================ */

app.get(
  "/chat",

  async (req, res) => {

    try {

      const userQuery =
        req.query.q ||
        "What is this document about?";

      console.log(
        "🔍 User Query:",
        userQuery
      );

      /* =========================
         LOAD EMBEDDINGS
      ========================= */

      const embeddings =
        new HuggingFaceTransformersEmbeddings({
          model:
            "Xenova/all-MiniLM-L6-v2",
        });

      console.log(
        "✅ Embeddings Loaded"
      );

      /* =========================
         CONNECT TO QDRANT
      ========================= */

      const vectorStore =
        await QdrantVectorStore.fromExistingCollection(
          embeddings,
          {
            url:
              "http://localhost:6333",

            collectionName:
              "pdf-collection",
          }
        );

      console.log(
        "✅ Connected To Qdrant"
      );

      /* =========================
         RETRIEVER
      ========================= */

      const retriever =
        vectorStore.asRetriever({
          k: 3,
        });

      const result =
        await retriever.invoke(
          userQuery
        );

      console.log(
        "✅ Retrieved Documents:",
        result.length
      );

      /* =========================
         SYSTEM PROMPT
      ========================= */

      const SYSTEM_PROMPT = `
You are a helpful AI assistant.

Answer ONLY from the provided context.

If the answer is not available in the context,
reply with:

"I don't know"

CONTEXT:

${result
  .map((doc) => doc.pageContent)
  .join("\n\n")}
`;

      /* =========================
         GEMINI MODEL
      ========================= */

      const model =
        genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

      const finalPrompt = `
${SYSTEM_PROMPT}

User Question:
${userQuery}
`;

      console.log(
        "🤖 Sending Prompt To Gemini..."
      );

      const geminiResult =
        await model.generateContent(
          finalPrompt
        );

      const answer =
        geminiResult.response.text();

      console.log(
        "✅ Gemini Response Generated"
      );

      return res.json({
        success: true,
        query: userQuery,
        answer,
      });

    } catch (err) {

      console.error(
        "❌ Chat Error:",
        err
      );

      return res.status(500).json({
        success: false,
        error: err.message,
      });

    }
  }
);

/* ================================
   START SERVER
================================ */

app.listen(8000, () => {

  console.log(
    "🚀 Server running on port 8000"
  );

});

//   async (job) => {
//     console.log(`Job:`, job.data);
//     const data = typeof job.data === "string" ? JSON.parse(job.data) : job.data;

//     // Load the PDF
//     const loader = new PDFLoader(data.path);
//     const docs = await loader.load();

//     // Split the PDF into chunks
//     const textSplitter = new RecursiveCharacterTextSplitter({
//       chunkSize: 100,
//       chunkOverlap: 3,
//     });
//     const chunks = await textSplitter.splitDocuments(docs);

//     const embeddings = new HuggingFaceTransformersEmbeddings({
//     model: "Xenova/all-MiniLM-L6-v2",
//     });

//    await QdrantVectorStore.fromDocuments(
//   chunks,
//   embeddings,
//   {
//     url: "http://localhost:6333",
//     collectionName: "pdf-collection",
//   }
// );

//     console.log(`Added ${chunks.length} chunks to Qdrant`);
//   },
//   {
//     concurrency: 100,
//     connection: { host: "localhost", port: 6379 },
//   },
// );