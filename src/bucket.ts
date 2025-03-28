import { CLOUDFLARE_ACCESS_KEY, CLOUDFLARE_URL, CLOUDFLARE_SECRET_KEY, CLOUDFLARE_PUBLIC_URL, IMAGES_FOLDER, consoleLog } from "./constants"
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from "fs";
import path from 'path';

const r2 = new S3Client({
    region: 'auto',
    endpoint: CLOUDFLARE_URL,
    credentials: {
        accessKeyId: CLOUDFLARE_ACCESS_KEY || '',
        secretAccessKey: CLOUDFLARE_SECRET_KEY || '',
    },
})

//this should take the full path
export async function uploadFileToR2(filename: string) {
    try {
        let extension = "";
        if (filename.split('.').length === 1) {
            extension = ".jpg";
        }

        const fullPath = path.join(__dirname, IMAGES_FOLDER, `${filename}${extension}`);
        consoleLog("fullPath", fullPath);

        //check file exists
        if (!fs.existsSync(fullPath)) {
            console.log("File does not exist", filename);
            return;
        }
        
        // Read the file content
        const fileContent = fs.readFileSync(`${fullPath}`);

        // Create the parameters for the PutObjectCommand
        const params = {
            Bucket: 'metadata', // Your R2 bucket name
            Key: filename, // The key (file name) to save the file as in the bucket
            Body: fileContent, // The content of the file
            ContentType: 'image/jpeg', // Set the content type as needed
            ACL: 'public-read', // Set the ACL as needed
        };

        // Create the command
        // @ts-ignore
        const command = new PutObjectCommand(params);

        // Use the send method to upload the file
        const data = await r2.send(command);
        consoleLog("Successfully uploaded to R2:", data);

        return data; // Return the response data if needed
    } catch (error) {
        console.error("Error uploading to R2:", error);
        throw error; // Rethrow the error for further handling
    }
}
