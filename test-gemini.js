
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found');
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // The SDK doesn't have a direct listModels but we can try common ones or check error responses
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
        for (const m of models) {
            try {
               const model = genAI.getGenerativeModel({ model: m });
               await model.generateContent("test");
               console.log(`Model ${m}: AVAILABLE`);
            } catch (e) {
               console.log(`Model ${m}: FAILED - ${e.message}`);
            }
        }
    } catch (err) {
        console.error(err);
    }
}
listModels();
