Audio TTS and STT using Google Gemini

Clone this reo on your local using CMD:
git clone https://github.com/alhatr60-blip/audio-tts.git

Navigate to the project directory:
cd audio-tts

Install backend dependencies:
cd backend
npm install

Install frontend dependencies:
cd frontend
npm install

Create .env file in backend folder and add the following:
GOOGLE_API_KEY="your_google_api_key"
PORT=4000

Run the backend server:
cd backend
npm run start

Run the frontend server:
cd frontend
npm run start

open http://localhost:3000 in your browser
