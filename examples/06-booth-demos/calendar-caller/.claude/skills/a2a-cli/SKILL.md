---
name: a2a-cli
description: >-
  Delegate work to A2A (Agent2Agent) agents from the command line with the `a2a`
  CLI (github.com/a2aproject/a2a-cli). Use when you need to hand a task to a
  specialized or remote agent, fetch an agent's card, send a message to an agent
  at a URL, stream or poll a running task, or check, list, resume, or cancel an
  A2A task. Not for building or serving an A2A agent, or for calling non-A2A
  HTTP APIs.
---

# Driving A2A agents with the `a2a` CLI

`a2a` is a stateless client for the [A2A protocol](https://a2a-protocol.org/):
give it an agent and a message, it negotiates the transport from the agent's
card (JSON-RPC, REST, or gRPC), sends the message, and reports what the agent
returned.

## Task lifecycle

1. **Inspect the agent**:
   ```bash
   a2a card get http://localhost:8081
   ```
2. **Send the initial message** (use `-o json` so you can read `.task.contextId` and `.task.id` from the JSON response):
   ```bash
   a2a send -a http://localhost:8081 -o json "Your initial request"
   ```
   The JSON output has the structure:
   ```json
   {
     "task": {
       "id": "<task-id>",
       "contextId": "<context-id>",
       "artifacts": [{ "parts": [{ "text": "..." }] }],
       "status": { "state": "TASK_STATE_COMPLETED" }
     }
   }
   ```
3. **Continue a multi-turn conversation in the same context** (pass the `contextId` from `.task.contextId`):
   ```bash
   a2a send -a http://localhost:8081 --context-id <context-id> -o json "Your follow-up answer"
   ```
4. **Answer an interrupted task** (`TASK_STATE_INPUT_REQUIRED`):
   ```bash
   a2a send -a http://localhost:8081 --task-id <task-id> -o json "Yes, proceed"
   ```
