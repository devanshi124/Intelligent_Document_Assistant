"use client";

import * as React from "react";
import {Upload} from 'lucide-react';
const FileUploadComponent: React.FC = () => {

const handleFileUploadButtonClick = () => {
    // Create a hidden file input element
    const el = document.createElement("input");
    el.type = "file";
    el.accept = ".pdf"; // Accept only PDF files
    el.addEventListener("change", async (ev) => {
        if(el.files && el.files.length >0) {
            const file = el.files.item(0);
            if(file){
            const formData = new FormData();
            formData.append("pdf", file);
            
            await fetch ("http://localhost:8000/upload/pdf", {
                method: "POST",
                body: formData
            })
        }
        }      
    
        });
    el.click();
};

    return (
        <div className="bg-slate-900 text-white shadow-2xl flex justify-center items-center p-4 rounded-lg border-2 border-white"> 
        <div onClick={handleFileUploadButtonClick} className="flex justify-center items-center flex-col">
        <h3>Upload PDF File</h3>
         <Upload />
        </div>
        </div>
    );
};

export default FileUploadComponent;