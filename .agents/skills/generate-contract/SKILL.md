---
name: generate-contract
description: Generates a professional contract using AI and saves it directly to the Wakalati CRM database.
---

# Generate Contract Skill

When the user asks to "generate a contract" or "create a contract with AI":

1. **Understand the Request**: Identify the client name, contract value, service type, and duration from the user's prompt.
2. **Draft the Contract**: Use your AI capabilities to write a professional contract tailored to the requested service.
3. **Database Insertion**:
   - Write a short temporary Node.js script to query the database using the Prisma schema at `backend/prisma/schema.prisma`.
   - Find or create the `Client` in the database.
   - Insert the new contract into the `Contract` table, storing the generated text in the `notes` field (or appropriate description field).
4. **No UI Coding Needed**: Just execute the script to push the data. Inform the user when it's done so they can see it in their CRM UI.
