import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

router.post('/generate_update', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ error: 'GEMINI_API_KEY is missing from environment variables.' });
        }

        const { context, currentTasks, project } = req.body;
        if (!context || !project) {
            return res.status(400).json({ error: 'Missing context or project details.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `You are an expert Project Manager AI. 
You are given a current project schedule and new textual context (e.g., meeting notes, progress updates, WBS tables).
Your job is to analyze the context and output a JSON list of operations.

CRITICAL: If the context contains a WBS (Work Breakdown Structure) or a list of tasks/subtasks, you MUST create the entire hierarchy.

Available Operations:
1. "update_task": Modify an existing task.
2. "create_task": Create a new task.

Handling Hierarchy in creating new tasks:
If you are creating multiple new nested tasks (e.g., a parent "Phase 1" and a child "Task 1.1"), you can use a "tempId" for the parent and reference that "tempId" in the "parentId" of the child.

JSON Format (CRITICAL: List Parent tasks BEFORE their children in the array):
[
  { 
    "type": "update_task", 
    "taskId": "<id from currentTasks>", 
    "changes": { 
      "progress": <number 0-100 or null>, 
      "start_date": "<YYYY-MM-DD or null>", 
      "end_date": "<YYYY-MM-DD or null>", 
      "title": "<new title if changed, or null>",
      "assignee": "<email or null>" 
    },
    "reasoning": "Short explanation of why this was updated based on the context."
  },
  { 
    "type": "create_task", 
    "tempId": "unique_string_for_this_batch",
    "parentId": "<id of parent from currentTasks, OR tempId of a task previously listed in this same array, or null if root level>",
    "task": { 
      "title": "Task Name", 
      "start_date": "YYYY-MM-DD", 
      "end_date": "YYYY-MM-DD", 
      "progress": 0,
      "assignee": "<email or null>"
    },
    "reasoning": "Short explanation of why this task was created."
  }
]

Current Project Details:
Project Name: ${project.name}
Project Start Date: ${project.start_date}

Current Tasks:
${JSON.stringify(currentTasks.map((t) => ({ id: t.id, title: t.title, start: t.start_date, end: t.end_date, progress: t.progress, assignee: t.assignee })), null, 2)}

New Context / Progress Update string from Admin:
"""
${context}
"""

Return ONLY the raw JSON array (no markdown, no backticks). 
CRITICAL: Generate the COMPLETE list of tasks mentioned in the context. Do not summarize, truncate, or skip any tasks. If a WBS (e.g. 1.1, 1.1.1) is provided, use it to accurately determine the parent-child relationships and nesting depth. If no changes are needed, return [].
`;

        const result = await model.generateContent(prompt);
        let textResult = result.response.text().trim();
        
        // Remove markdown formatting if the model accidentally included it
        if (textResult.startsWith('\`\`\`json')) {
            textResult = textResult.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim();
        } else if (textResult.startsWith('\`\`\`')) {
            textResult = textResult.replace(/^\`\`\`/m, '').replace(/\`\`\`$/m, '').trim();
        }

        const operations = JSON.parse(textResult);

        res.json({ operations });
    } catch (error) {
        console.error('[AI] Generation error:', error);
        res.status(500).json({ error: error.message || 'AI processing failed' });
    }
});

export default router;
