# NeuralBridge

NeuralBridge is a modern local AI chat workspace built with Next.js. It provides a polished chat interface for routing prompts to a local or self-hosted model endpoint, with support for model selection, image prompts, markdown rendering, chat history, and light/dark themes.

## Features

- Local AI chat interface with configurable backend URL
- Model picker with editable model list
- Image upload support for multimodal model requests
- Markdown rendering with code blocks, tables, lists, and copy actions
- Persisted chat sessions in browser storage
- Light and dark theme support
- Next.js API route that proxies chat requests to an Ollama-compatible `/api/chat` endpoint

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Lucide React icons

## Project Structure

```text
.
├── LICENSE
├── README.md
└── neural-bridge/
    ├── app/
    │   ├── api/chat/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── package.json
    └── public/
```

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- A local or remote Ollama-compatible chat endpoint

### Install Dependencies

```bash
cd neural-bridge
npm install
```

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Model Backend

NeuralBridge sends chat requests through the Next.js API route at:

```text
/api/chat
```

That route forwards requests to the configured backend URL and appends `/api/chat` when needed. In the app settings, set the backend URL to your model runner, for example:

```text
http://localhost:11434
```

or an exposed tunnel URL such as:

```text
https://your-ngrok-url.ngrok.app
```

The selected model name should match a model available on your backend, such as `llama3.2:3b`, `llama3.1:8b`, `qwen2.5:7b`, or `mistral:7b`.

## Available Scripts

Run these from the `neural-bridge/` directory.

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- Chat sessions are stored in browser `localStorage`.
- Uploaded images are sent with the current request but stripped before sessions are saved locally to avoid storage bloat.
- The proxy route includes the `ngrok-skip-browser-warning` header for tunneled backend URLs.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1we2Nfh24ii0scECCEfbQowETzaHglP05?usp=sharing)

<img width="1697" height="943" alt="Screenshot 2026-04-22 at 10 06 24 AM" src="https://github.com/user-attachments/assets/3a332eaf-9793-4036-ba72-3eda301ce084" />

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
