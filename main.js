// line number 44 for API Key 

// --- HTML Element References ---
const texts = document.querySelector('.texts');
const startBtn = document.getElementById('start'); // Renamed "Analyze Resume & Prepare"
const stopBtn = document.getElementById('stop');
const answerCompleteBtn = document.getElementById('answerComplete');
const thankYouMessage = document.getElementById('thankYouMessage');
const feedbackBlock = document.getElementById('feedbackBlock');
const uploadSection = document.getElementById('uploadSection');
const container = document.getElementById('container'); // Interview Q&A area
const submitFeedbackBtn = document.getElementById('submitFeedback');
const downloadButtonDiv = document.getElementById('downloadButton'); // Div containing the download button
const downloadPdfBtn = document.getElementById('downloadPdfBtn'); // The actual download button
const video = document.getElementById('backgroundVideo');
// const audio = new Audio('greeting.mp3'); // Optional: If you have a greeting sound file

// New Elements
const atsScoreDisplay = document.getElementById('atsScoreDisplay');
const atsTipsDisplay = document.getElementById('atsTipsDisplay');
const loadingIndicator = document.getElementById('loadingIndicator');
const resumeFileInput = document.getElementById('resume');
const jobRoleSelect = document.getElementById('jobRole');
const atsDisplaySection = document.getElementById('atsDisplaySection'); // Contains ATS info + Proceed button
const proceedInterviewBtn = document.getElementById('proceedInterviewBtn'); // New button to start interview
const postInterviewSection = document.getElementById('postInterviewSection'); // Contains thank you, feedback, download
const feedbackGenerationStatus = document.getElementById('feedbackGenerationStatus'); // NEW: To show feedback analysis status

// --- State Variables ---
let questions = [];
let answers = [];
// NEW: answerFeedback stores objects: { analysis?: string, suggestion?: string, grammarNotes?: string, exampleAnswer?: string, error?: string }
let answerFeedback = [];
let currentQuestionIndex = 0;
let recognitionActive = false;
let feedbackText = '';
let isSpeaking = false;
let resumeTextContent = ''; // Keep this if you implement parsing
let atsScore = null;
let atsTips = '';
let currentJobRole = ''; // Store selected job role
let isAnalyzingAnswers = false; // NEW: Flag to prevent concurrent analysis

// --- API Configuration ---
// <!> IMPORTANT: Replace with your key. Using a backend proxy is STRONGLY recommended for production!
const GEMINI_API_KEY = 'your api key'; // <<<<<<----- REPLACE THIS WITH YOUR ACTUAL KEY
// --- /API Configuration ---
// Make sure the API key is replaced above before use!
if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || !GEMINI_API_KEY) {
    console.error("CRITICAL: Gemini API Key is not set. Please replace 'YOUR_GEMINI_API_KEY' in the code.");
    alert("API Key is missing. The application might not work correctly.");
    // Disable critical functionality if key is missing
    if(startBtn) startBtn.disabled = true;
    if(proceedInterviewBtn) proceedInterviewBtn.disabled = true;
}
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; // Using latest flash model


// --- Speech Recognition Setup ---
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!window.SpeechRecognition) {
    console.error("Speech Recognition not supported in this browser.");
    alert("Speech Recognition is not supported in this browser. Please use Chrome or Edge.");
    // Disable features reliant on speech recognition
    if(startBtn) startBtn.disabled = true;
    // Hide elements that won't work
    if(container) container.style.display = 'none';
    if(uploadSection) uploadSection.innerHTML = '<p style="color:red;">Speech Recognition is required for this tool and is not supported by your browser.</p>';

} else {
    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Or 'hi-IN' for Hindi if needed

    recognition.addEventListener('result', (e) => {
        if (isSpeaking) return; // Ignore input if AI is talking

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = e.resultIndex; i < e.results.length; ++i) {
            if (e.results[i].isFinal) {
                finalTranscript += e.results[i][0].transcript.trim() + ' '; // Add space
            } else {
                interimTranscript += e.results[i][0].transcript;
            }
        }
         finalTranscript = finalTranscript.trim(); // Trim trailing space

        // Update display
        const currentAnswer = finalTranscript + interimTranscript;
        updateAnswerDisplay(currentAnswer);

        // Update stored answer ONLY if it's final AND the interview is still in the question phase
        if (finalTranscript && e.results[e.results.length - 1].isFinal && currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
             console.log("Final Answer Recorded:", finalTranscript);
             answers[currentQuestionIndex] = finalTranscript;
         }
    });

    recognition.addEventListener('end', () => {
        console.log("Recognition ended.");
        // Ensure restart only happens if intended (active, not speaking, not analyzing)
        if (recognitionActive && !isSpeaking && !isAnalyzingAnswers && currentQuestionIndex < questions.length) {
            console.log("Attempting to restart recognition after 'end' event.");
            try {
                // Prevent immediate restart if stopInterview was just called
                setTimeout(() => {
                    if (recognitionActive && !isSpeaking && !isAnalyzingAnswers && currentQuestionIndex < questions.length) {
                        recognition.start();
                    } else {
                         console.log("Recognition restart condition false after short delay in 'end' handler.");
                    }
                }, 50); // Small delay
            } catch(error) {
                 if (error.name !== 'InvalidStateError') { // Ignore error if already started or stopped
                     console.error("Error restarting recognition after 'end':", error);
                 } else {
                     console.log("Recognition restart aborted after 'end' (likely state changed).");
                 }
            }
        } else {
             console.log("Recognition restart skipped after 'end' (Not active, speaking, analyzing, or interview ended).");
        }
    });

    recognition.addEventListener('error', (event) => {
        console.error('Speech recognition error:', event.error, event.message);
        // Only show alerts for critical/unrecoverable errors
        if (event.error === 'audio-capture') {
            alert('Error capturing audio. Please check microphone permissions and hardware.');
            if (recognitionActive) stopInterview(true);
        } else if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone access in your browser settings.');
             if (recognitionActive) stopInterview(true);
        } else if (event.error === 'network') {
             alert("Network error during speech recognition. Please check your connection.");
             // Don't necessarily stop the interview for a temporary network error
        } else if (event.error === 'no-speech' && recognitionActive) {
             console.log("No speech detected."); // Don't alert, let 'end' handle potential restart
        } else if (event.error === 'aborted') {
             console.log("Recognition aborted (likely intentional)."); // Don't alert
        } else if (event.error === 'service-not-allowed') {
             alert('Speech service denied. This might be temporary or due to browser/OS settings.');
             if (recognitionActive) stopInterview(true);
        } else {
            // Alert for other unexpected errors
            alert(`An unknown speech recognition error occurred: ${event.error}`);
             if (recognitionActive) stopInterview(true);
        }
         // Ensure recognitionActive is false if stopped due to critical error
         if(['audio-capture', 'not-allowed', 'service-not-allowed'].includes(event.error)) {
             recognitionActive = false;
         }
    });

    // --- Speech Synthesis Setup ---
    if (!('speechSynthesis' in window)) {
         console.error("Speech Synthesis not supported in this browser.");
         alert("Speech Synthesis is not supported. The AI interviewer will not speak.");
     }

    function speak(text, callback) {
        if (!text || !('speechSynthesis' in window)) {
            console.warn("Skipping speech: No text or synthesis not supported.");
            if(callback) setTimeout(callback, 50);
            return;
        }

        let wasRecognitionActive = recognitionActive;
        if (recognitionActive) {
            console.log("Stopping recognition before speaking.");
            // Set flag first to prevent 'end' event from restarting immediately
            recognitionActive = false;
            try {
                 recognition.abort(); // Use abort() for immediate stop
                 console.log("Recognition aborted before speaking.");
            } catch (e) { console.warn("Tried to abort recognition before speaking, might already be stopped/inactive."); }
        }

        isSpeaking = true;
        console.log("AI Speaking:", text);
        const utterance = new SpeechSynthesisUtterance(text);
        // Try to find a suitable voice (logic remains the same)
        const voices = speechSynthesis.getVoices();
        let voice = voices.find(v => v.name.includes('Google UK English Female') && v.lang.startsWith('en')) ||
                    voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                    voices.find(v => v.lang === 'en-GB') ||
                    voices.find(v => v.lang.startsWith('en')); // Broader fallback
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang;
            // console.log(`Using voice: ${voice.name} (${voice.lang})`);
        } else {
            utterance.lang = 'en-US';
             console.log("Using default en-US voice.");
        }


        utterance.onstart = () => {
            console.log("Speech synthesis started.");
            if (video) video.play().catch(e => console.warn("Video play failed:", e));
        };

        utterance.onend = () => {
            console.log("Speech synthesis ended.");
            isSpeaking = false;
            if (video) video.pause();

            // Restart recognition ONLY if it was active before speaking AND interview is still ongoing (not analyzing)
            if (wasRecognitionActive && currentQuestionIndex < questions.length && !isAnalyzingAnswers) {
                 recognitionActive = true; // OK to restart now
                 console.log("Attempting to restart recognition after speaking.");
                 // Use a small delay before starting recognition again
                 setTimeout(() => {
                     if (recognitionActive && !isSpeaking && !isAnalyzingAnswers && currentQuestionIndex < questions.length) { // Double-check state
                        try {
                            recognition.start();
                            console.log("Recognition restarted after delay.");
                        } catch (error) {
                            if (error.name !== 'InvalidStateError') {
                                console.error("Error restarting recognition after speak delay:", error);
                            } else {
                                console.log("Recognition already started or state changed during delay.");
                            }
                        }
                     } else {
                         console.log("Recognition restart condition false after delay.");
                     }
                 }, 150); // Slightly longer delay (150ms) might be safer

            } else {
                console.log("Recognition not restarted after speech (not previously active, interview ended, or analyzing).");
            }
            if (callback) callback(); // Execute callback regardless
        };

        utterance.onerror = (event) => {
            console.error("Speech synthesis error:", event.error, event.message);
            isSpeaking = false; // Ensure flag is reset
            if (video) video.pause();

            // Don't alert for common errors like 'interrupted' or 'canceled'
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
              alert(`Speech synthesis error: ${event.error}. The AI might stop speaking.`);
            }

            // Attempt to restart recognition if needed, similar to onend logic
             if (wasRecognitionActive && currentQuestionIndex < questions.length && !isAnalyzingAnswers) {
                 recognitionActive = true;
                 console.log("Attempting to restart recognition after speech error.");
                  setTimeout(() => {
                      if (recognitionActive && !isSpeaking && !isAnalyzingAnswers && currentQuestionIndex < questions.length) {
                         try { recognition.start(); } catch (error) { console.error("Error restarting recognition after speech error:", error); }
                      }
                  }, 150);
             }
            if (callback) callback(); // Still execute callback to allow flow to continue
        };

         // Ensure voices are loaded (important for some browsers)
         const startSpeaking = () => {
             speechSynthesis.cancel(); // Cancel any previous speech first
             speechSynthesis.speak(utterance);
         };

         // Voice loading logic remains the same...
          if (speechSynthesis.getVoices().length === 0) {
             console.log("Waiting for voices to load...");
              speechSynthesis.addEventListener('voiceschanged', () => {
                  console.log("Voices loaded on demand.");
                  const updatedVoices = speechSynthesis.getVoices();
                  let updatedVoice = updatedVoices.find(v => v.name.includes('Google UK English Female') && v.lang.startsWith('en')) ||
                                    updatedVoices.find(v => v.lang === 'en-US' && v.name.includes('Google')) ||
                                    updatedVoices.find(v => v.lang === 'en-GB') ||
                                    updatedVoices.find(v => v.lang.startsWith('en'));
                  if (updatedVoice) {
                      utterance.voice = updatedVoice;
                      utterance.lang = updatedVoice.lang;
                  }
                  startSpeaking();
              }, { once: true });
          } else {
              startSpeaking();
          }
    }

    // --- Display Logic ---
    function displayQuestion(question) {
        texts.innerHTML = ''; // Clear previous Q&A
        const questionElem = document.createElement('p');
        questionElem.classList.add('question');
        questionElem.innerText = `Q: ${question}`;
        texts.appendChild(questionElem);

        const answerElem = document.createElement('p');
        answerElem.classList.add('answer');
        answerElem.innerText = `A: ... (Listening)`; // Indicate listening state
        texts.appendChild(answerElem);
    }

    function updateAnswerDisplay(answerText) {
        const answerElem = texts.querySelector('.answer');
        if (answerElem && !isAnalyzingAnswers) {
            answerElem.innerText = `A: ${answerText || '...'}`; // Show '...' if text is empty
        }
    }

    function showLoading(message = "Processing...") {
        if (loadingIndicator) {
             loadingIndicator.innerText = message;
             loadingIndicator.style.display = 'block';
        }
    }

    function hideLoading() {
        if (loadingIndicator) {
             loadingIndicator.style.display = 'none';
        }
    }

    function displayATSInfo() {
        if (atsScoreDisplay) atsScoreDisplay.innerHTML = `<strong>Simulated ATS Score:</strong> ${atsScore !== null ? atsScore + '%' : 'N/A'}`;
        if (atsTipsDisplay) atsTipsDisplay.innerHTML = `<strong>Resume Improvement Tips:</strong><br>${atsTips ? atsTips.replace(/\n/g, '<br>') : 'No tips available.'}`;
        if (atsScoreDisplay) atsScoreDisplay.style.display = 'block';
        if (atsTipsDisplay) atsTipsDisplay.style.display = 'block';
        if (atsDisplaySection) atsDisplaySection.style.display = 'block';
    }

    // --- Core Logic ---

    // Step 1: Analyze Resume & Prepare
    async function handleAnalyzeAndPrepare() {
        console.log("Analyze & Prepare button clicked.");
        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || !GEMINI_API_KEY) {
             alert("ERROR: API Key not configured. Please set the GEMINI_API_KEY variable in the script.");
             return;
        }
        const resumeFile = resumeFileInput.files[0];
        currentJobRole = jobRoleSelect.value;

        if (!resumeFile || !currentJobRole) {
            alert('Please upload your resume and select the interview type.');
            return;
        }

        // Reset state thoroughly before starting
        resetInterviewState();

        startBtn.disabled = true;
        proceedInterviewBtn.disabled = true; // Keep disabled until prep complete
        uploadSection.style.display = 'none';
        atsDisplaySection.style.display = 'none';
        container.style.display = 'none';
        postInterviewSection.style.display = 'none';
        showLoading("Analyzing Resume and Preparing Interview...");

        try {
            resumeTextContent = await extractTextFromResume(resumeFile);

            console.log("Getting ATS Score/Tips for role:", currentJobRole);
            const atsResult = await getATSScoreAndTips(resumeTextContent, currentJobRole);
            atsScore = atsResult.score;
            atsTips = atsResult.tips;
            displayATSInfo();

            console.log("Fetching questions from Gemini...");
            questions = await fetchQuestionsFromGemini(resumeTextContent, currentJobRole);

            if (!questions || questions.length === 0) {
                 console.warn("Gemini failed to generate questions or returned none. Using fallback.");
                 questions = getFallbackQuestions(currentJobRole);
                 if (!questions || questions.length === 0) {
                    throw new Error("Failed to generate interview questions (AI and fallback).");
                 }
                 alert("Using standard fallback questions as AI generation failed.");
            }

            // Initialize arrays based on actual questions length
            answers = new Array(questions.length).fill('');
            answerFeedback = new Array(questions.length).fill(null);

            console.log(`Questions prepared (${questions.length}):`, questions);

            hideLoading();
            proceedInterviewBtn.disabled = false; // Enable proceed button

        } catch (error) {
            console.error("Error during preparation phase:", error);
            hideLoading();
            alert(`Failed to prepare interview: ${error.message}\nPlease check API Key, quota, network, or try again.`);
            resetToUploadState();
        }
    }

    // Step 2: Start Interview
    function handleProceedToInterview() {
        console.log("Proceed to Interview button clicked.");
        if (!questions || questions.length === 0) {
             alert("Cannot start interview: No questions prepared.");
             resetToUploadState();
             return;
         }

        atsDisplaySection.style.display = 'none'; // Hide ATS info
        container.style.display = 'block';       // Show Q&A area
        stopBtn.disabled = false;
        answerCompleteBtn.disabled = false;
        proceedInterviewBtn.disabled = true;     // Disable itself
        startBtn.disabled = true; // Disable start button during interview

        playGreeting(() => {
            startInterviewFlow(); // Start asking questions after greeting
        });
    }

    // Attach listeners only if buttons exist
    if(startBtn) startBtn.addEventListener('click', handleAnalyzeAndPrepare);
    if(proceedInterviewBtn) proceedInterviewBtn.addEventListener('click', handleProceedToInterview);


    // Placeholder/Simulation Functions (Keep or replace as needed)
     async function extractTextFromResume(file) {
        console.warn("Using placeholder/basic text extraction for resume.");
        // NOTE: Robust PDF/DOCX extraction usually requires a backend or heavy client-side libraries.
        return new Promise((resolve) => {
            if (file.type === "text/plain") {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result || `Read text file: ${file.name}`);
                reader.onerror = (err) => {
                    console.error("File reading error:", err);
                    resolve(`Error reading file: ${file.name}`);
                };
                reader.readAsText(file);
            } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
                 resolve(`Placeholder content for PDF: ${file.name}. Skills: Leadership, Communication. Experience: 5 years Project Management. Developed new system, improved efficiency. I has managed teams.`);
             } else if (file.type.includes("wordprocessingml") || file.name.toLowerCase().endsWith(".docx")) {
                 resolve(`Placeholder content for DOCX: ${file.name}. Objective: Seeking challenging role. Skills: Java, Python. Education: BSc Computer Science. Led project team, result was good. Implemented features for customer.`);
             } else {
                resolve(`Placeholder: Cannot read content of file type ${file.type} easily on client-side. File: ${file.name}`);
            }
        });
    }

    async function getATSScoreAndTips(resumeText, jobRole) {
        // ATS Simulation logic remains the same...
        console.warn("Simulating ATS Score and Tips based on basic checks.");
        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate tiny delay
        let score = 40;
        let tips = `- Ensure resume format is standard and parsable.\n`;
        const resumeLower = resumeText.toLowerCase();
        const roleLower = jobRole.toLowerCase();
        const keywords = {
            'software': ['java', 'python', 'api', 'database', 'git', 'agile', 'problem solving', 'developer', 'test', 'deploy'],
            'hr': ['recruitment', 'onboarding', 'employee relations', 'communication', 'conflict resolution', 'hris', 'compensation', 'benefits'],
            'ml': ['python', 'tensorflow', 'pytorch', 'scikit-learn', 'machine learning', 'data analysis', 'statistics', 'models', 'neural network', 'nlp'],
            'resume based': ['experience', 'skills', 'achievements', 'project', 'teamwork', 'leadership', 'communication', 'problem solving'] // Generic
        };
        const roleKeywords = keywords[Object.keys(keywords).find(k => roleLower.includes(k)) || 'resume based'];
        let foundKeywords = 0;
        roleKeywords.forEach(kw => {
            if (resumeLower.includes(kw)) {
                score += 3; // Slightly reduced score per keyword
                foundKeywords++;
            } else {
                tips += `- Consider adding/highlighting keyword: '${kw}'.\n`;
            }
        });
        if (foundKeywords < roleKeywords.length / 2) tips += `- Include more keywords relevant to the '${jobRole}' role.\n`;
         if (resumeLower.match(/\d+%|\$\d+|\d+\s+(users|customers|projects|years|team members)/)) {
             score += 15;
             tips += `- Good: Includes quantifiable achievements.\n`;
         } else {
             tips += `- Quantify achievements where possible (e.g., 'Increased sales by 15%', 'Managed team of 5').\n`;
         }
         if (resumeLower.includes("developed") || resumeLower.includes("managed") || resumeLower.includes("led") || resumeLower.includes("implemented") || resumeLower.includes("created") || resumeLower.includes("designed") || resumeLower.includes("optimized")) {
             score += 8;
         } else {
             tips += `- Use strong action verbs to start bullet points (e.g., Developed, Managed, Led).\n`;
         }
        score = Math.min(95, Math.max(40, score + Math.floor(Math.random() * 10)));
        tips += "- Proofread carefully for typos and grammar errors.\n- Tailor the resume to match the specific job description.";
        return { score, tips };
    }

    // Fetch Questions using Gemini API (logic remains the same)
    async function fetchQuestionsFromGemini(resumeText, jobRole) {
        console.log(`Fetching questions for role: ${jobRole}`);
        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || !GEMINI_API_KEY) {
             console.error("Gemini API Key not set! Cannot fetch questions.");
             return []; // Return empty, fallback will be used
        }

        let prompt;
        const questionCount = 5; // Adjust as needed
        const isPlaceholderResume = resumeText.toLowerCase().startsWith("placeholder:") || resumeText.length < 50;

        if (jobRole.toLowerCase() === 'resume based interview') {
             if (isPlaceholderResume) {
                 prompt = `Generate ${questionCount} diverse interview questions suitable for a general job interview, covering topics like experience, skills, challenges, teamwork, and career goals. Ask open-ended questions. Format: One question per line, no numbering or prefixes.`;
                 console.warn("Using generic prompt for 'Resume Based Interview' due to placeholder/short resume text.");
             } else {
                 const summary = resumeText.substring(0, 1800) + (resumeText.length > 1800 ? "..." : "");
                 prompt = `Based *only* on the following resume content, generate ${questionCount} specific, open-ended interview questions probing deeper into the candidate's experience, skills, or achievements mentioned. Focus on behavioral or situational questions ("Tell me about a time...", "Describe how you...", "Give an example of...").\n\nResume Content:\n"${summary}"\n\nFormat: One question per line, no numbering or prefixes.`;
             }
        } else {
            prompt = `Generate ${questionCount} diverse interview questions for a first-round interview for the role of "${jobRole}". Include a mix of behavioral (STAR method), general technical (if applicable, no complex coding), and situational questions. Focus on relevant skills, problem-solving approach, teamwork, handling challenges, and motivation for *this specific role*. Format: One question per line, no numbering or prefixes.`;
        }

        // console.log("Gemini Prompt (first 100 chars):", prompt.substring(0,100) + "...");

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                     generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
                     safetySettings: [
                       { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                       { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                       { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                       { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                     ]
                })
            });

            if (!response.ok) {
                 const errorBody = await response.text();
                 console.error("Gemini API Error (Questions) Status:", response.status, "Body:", errorBody);
                 let errorMessage = `API Error: ${response.status}`;
                 try { errorMessage = JSON.parse(errorBody)?.error?.message || errorMessage; } catch (e) {}
                 console.error("Failed to fetch questions from Gemini:", errorMessage);
                 return [];
             }

            const data = await response.json();
            const candidate = data?.candidates?.[0];
             if (!candidate) {
                 console.error("No candidate data found in Gemini response:", JSON.stringify(data).substring(0, 500));
                 return [];
             }
             if (candidate.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                 console.warn(`Gemini generation finished unexpectedly: ${candidate.finishReason}`);
                 if (candidate.finishReason === "SAFETY") {
                      console.error("AI response blocked due to safety settings.", candidate.safetyRatings);
                      alert("The AI could not generate questions due to safety filters. Trying fallback questions.");
                 } else {
                     alert(`AI generation issue (${candidate.finishReason}). Trying fallback questions.`);
                 }
                 return [];
             }
             const generatedText = candidate?.content?.parts?.[0]?.text;
             if (generatedText) {
                 const generatedQuestions = generatedText.split('\n')
                                                .map(q => q.trim().replace(/^[\d.*\-–—\s]+/, '').replace(/^Q\d*[:.]?\s*/i, '').trim())
                                                .filter(q => q.length > 10 && q.includes('?') && !q.toLowerCase().includes("analysis:") && !q.toLowerCase().includes("suggestion:"));
                 if (generatedQuestions.length === 0) {
                     console.warn("AI generated text parsed into zero valid questions. Raw text:", generatedText);
                     return [];
                 }
                  if (generatedQuestions.length < questionCount) {
                     console.warn(`AI generated only ${generatedQuestions.length}/${questionCount} valid questions.`);
                 }
                 console.log("Parsed Questions:", generatedQuestions);
                 return generatedQuestions.slice(0, questionCount);
             } else {
                console.error("No text content found in Gemini response candidate part:", JSON.stringify(candidate).substring(0, 500));
                return [];
             }

        } catch (error) {
            console.error('Error fetching/processing questions from Gemini:', error);
            alert(`Network or processing error fetching questions: ${error.message}. Trying fallback.`);
            return [];
        }
    }

     // Fallback Questions (logic remains the same)
     function getFallbackQuestions(role) {
         console.warn("Using fallback questions for role:", role);
         const baseQuestions = [
              'Can you tell me a little about yourself and your relevant background?',
              'What are your greatest professional strengths that align with this role?',
              'What do you consider to be your biggest area for professional development?', // Softer framing
              'Why are you interested in this specific role at our company?',
              'Describe a time you faced a significant challenge or setback at work and how you handled it.',
              'Where do you see yourself professionally in the next 3-5 years, and how does this role fit in?',
              'Can you give an example of how you have worked effectively within a team to achieve a common goal?',
              'How do you typically prioritize your tasks when faced with multiple deadlines?',
          ];
         const roleLower = role.toLowerCase();
         let specificQs = [];
         if (roleLower.includes('software') || roleLower.includes('developer') || roleLower.includes('application')) {
             specificQs = ['Describe a technically challenging project you worked on. What was your specific contribution?', 'How do you approach learning new technologies or programming languages?'];
         } else if (roleLower.includes('hr')) {
              specificQs = ['How do you stay updated on current HR laws and best practices?', 'Describe a time you had to mediate a conflict between employees.'];
          } else if (roleLower.includes('ml') || roleLower.includes('data scientist')) {
              specificQs = ['Can you explain a complex machine learning concept to a non-technical audience?', 'Describe your process for evaluating the performance of a model you built.'];
          } else {
              specificQs = ['Looking at your resume, can you elaborate on your experience with [mention a key skill area if possible, otherwise "a key project"]?', 'How does your previous experience prepare you for the responsibilities of this position?'];
          }

         const combined = [];
         combined.push(baseQuestions[0]); // About yourself
         combined.push(specificQs[0] || baseQuestions[4]); // Specific Q1 or Challenge Q
         combined.push(baseQuestions[1]); // Strengths
         combined.push(specificQs[1] || baseQuestions[6]); // Specific Q2 or Teamwork Q
         combined.push(baseQuestions[3]); // Why this role?

         return combined.slice(0, 5); // Return exactly 5 questions
     }


    // Greeting function
    function playGreeting(callback) {
        console.log("Playing greeting...");
        speak("Hello! I'm Lisa, your AI interviewer. I'm ready to begin when you are. I'll ask the first question shortly.", callback);
    }

    // Function to start the Q&A flow
    function startInterviewFlow() {
        if (!questions || questions.length === 0) {
            alert("Error: No questions available. Cannot start interview.");
            resetToUploadState();
            return;
        }
        console.log("Starting Interview Flow...");
        currentQuestionIndex = 0;
        recognitionActive = true; // Enable recognition flag
        isAnalyzingAnswers = false;
        askNextQuestion(); // Ask the first question
    }

    function askNextQuestion() {
        if (currentQuestionIndex < questions.length) {
            const question = questions[currentQuestionIndex];
            console.log(`Asking Question ${currentQuestionIndex + 1}/${questions.length}: ${question}`);
            displayQuestion(question); // Display Q, placeholder A
            answers[currentQuestionIndex] = ''; // Ensure answer slot is fresh
            recognitionActive = true; // Ensure recognition is expected to be active for the answer

            // Speak the question. `speak` function handles restarting recognition in its `onend` callback.
            speak(question, () => {
                console.log(`Ready for answer to question ${currentQuestionIndex + 1}`);
                // Recognition restart is handled by speak()'s onend/onerror + delay logic
            });
        } else {
            console.warn("askNextQuestion called but index is out of bounds. Stopping naturally.");
            stopInterview(false); // End naturally
        }
    }


    // --- Button Event Listeners ---

    if (stopBtn) stopBtn.addEventListener('click', () => {
        stopInterview(true); // User manually stopped
    });

    // stopInterview function remains largely the same as the updated one previously provided
    async function stopInterview(manuallyStopped = false) {
        if (isAnalyzingAnswers) {
            console.log("Stop request ignored: Analysis already in progress.");
            return;
        }
        console.log(`Stopping interview... (Manually stopped: ${manuallyStopped})`);

        recognitionActive = false;
        isAnalyzingAnswers = true;
        isSpeaking = false;

        if (typeof recognition !== 'undefined') {
            try {
                recognition.stop();
                console.log("Speech recognition stopped.");
            } catch (e) {
                try { recognition.abort(); console.log("Speech recognition aborted."); }
                catch (e2) { console.warn("Could not stop/abort recognition:", e2); }
            }
        }
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.cancel();
            console.log("Speech synthesis cancelled.");
        }
        if (video && !video.paused) {
            video.pause();
            console.log("Video paused.");
        }

        if (container) container.style.display = 'none';
        if (atsDisplaySection) atsDisplaySection.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'block';
        hideLoading();
        if (postInterviewSection) postInterviewSection.style.display = 'block';
        if (thankYouMessage) {
            thankYouMessage.innerText = 'Interview Completed!';
            thankYouMessage.style.display = 'block';
        }
        if (feedbackBlock) feedbackBlock.style.display = 'block';
        if (downloadButtonDiv) downloadButtonDiv.style.display = 'block';

        if (downloadPdfBtn) {
            downloadPdfBtn.style.display = 'inline-block';
            downloadPdfBtn.disabled = true;
            downloadPdfBtn.innerText = "Generating Report...";
        }

        if (feedbackGenerationStatus) {
            feedbackGenerationStatus.style.display = 'block';
            feedbackGenerationStatus.innerText = 'Analyzing answers, please wait...';
        }

        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (answerCompleteBtn) answerCompleteBtn.disabled = true;
        if (proceedInterviewBtn) proceedInterviewBtn.disabled = true;
        if (submitFeedbackBtn) {
            submitFeedbackBtn.disabled = false;
            submitFeedbackBtn.innerText = "Submit Feedback";
        }

        console.log("Starting answer analysis...");
        console.log("Final Answers Recorded:", answers.map((ans, i) => `Q${i+1}: ${ans || '(empty)'}`).join('\n'));

        try {
            // Ensure questions and answers arrays are valid before analysis
            const validQuestions = Array.isArray(questions) ? questions : [];
            const validAnswers = Array.isArray(answers) ? answers : [];
            answerFeedback = await analyzeAllAnswers(validQuestions, validAnswers); // Pass validated arrays
            console.log("Answer analysis complete.");
            if (feedbackGenerationStatus) feedbackGenerationStatus.innerText = 'Feedback generated. PDF Report is ready.';
            if (downloadPdfBtn) {
                downloadPdfBtn.disabled = false;
                downloadPdfBtn.innerText = "Download PDF Report";
            }
        } catch (error) {
            console.error("Error during answer analysis phase:", error);
            if (feedbackGenerationStatus) feedbackGenerationStatus.innerText = `Error generating feedback: ${error.message}. Report may lack detailed analysis.`;
            if (downloadPdfBtn) {
                 downloadPdfBtn.disabled = false;
                 downloadPdfBtn.innerText = "Download PDF (Analysis Error)";
            }
            // Populate feedback array with error objects for PDF generation
            answerFeedback = new Array(questions.length).fill({ error: `Feedback generation failed. ${error.message}` });
        } finally {
             isAnalyzingAnswers = false; // Analysis phase finished
             console.log("Answer analysis phase ended.");
        }
    }

    if (answerCompleteBtn) answerCompleteBtn.addEventListener('click', () => {
        console.log("Answer Complete clicked for Q:", currentQuestionIndex + 1);

        // Stop recognition immediately
        recognitionActive = false;
        if (typeof recognition !== 'undefined') {
             try {
                recognition.stop();
                console.log("Recognition stopped by Answer Complete.");
             } catch(e){ console.warn("Error stopping recognition on Answer Complete:", e); }
        }
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.cancel(); // Stop AI if it was somehow interrupted/speaking
        }
        isSpeaking = false;

        // Short delay to allow final transcript processing
        setTimeout(() => {
            const finalAnswer = answers[currentQuestionIndex] || '(No answer recorded)';
            console.log(`Processing final answer for Q${currentQuestionIndex + 1}: "${finalAnswer.substring(0, 50)}..."`);

            if (currentQuestionIndex < questions.length - 1) {
                currentQuestionIndex++;
                console.log(`Moving to question ${currentQuestionIndex + 1}`);
                // Don't set recognitionActive=true here; askNextQuestion will handle it before speaking
                askNextQuestion();
            } else {
                console.log("Last answer complete. Ending interview naturally.");
                stopInterview(false); // End naturally (triggers analysis)
            }
        }, 300); // 300ms delay
    });

    if (submitFeedbackBtn) submitFeedbackBtn.addEventListener('click', () => {
        const feedbackInput = document.getElementById('feedback');
        if (feedbackInput) {
            feedbackText = feedbackInput.value;
            if (feedbackText.trim()) {
                alert('Thank you for your feedback!');
                console.log("User Feedback submitted:", feedbackText);
                submitFeedbackBtn.disabled = true;
                submitFeedbackBtn.innerText = "Feedback Submitted";
            } else {
                alert("Please enter some feedback before submitting.");
            }
        } else {
             console.error("Feedback input element not found.");
        }
    });

    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', () => {
        console.log("Generate PDF button clicked.");
        generatePDF();
    });


    // --- NEW: Answer Analysis Functions ---

    async function analyzeAllAnswers(qs, ans) {
        if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || !GEMINI_API_KEY) {
             console.error("Cannot analyze answers: Gemini API Key not set/valid.");
             throw new Error("API Key not configured for analysis");
         }
         // Ensure qs and ans are arrays
         if (!Array.isArray(qs) || !Array.isArray(ans)) {
            console.error("Invalid input to analyzeAllAnswers: questions or answers is not an array.");
            throw new Error("Internal error: Invalid data for analysis.");
         }
         if (qs.length !== ans.length) {
             console.warn(`Mismatch between questions (${qs.length}) and answers (${ans.length}) count.`);
             // Adjust to the minimum length to avoid errors, although this indicates a prior issue.
             const minLength = Math.min(qs.length, ans.length);
             qs = qs.slice(0, minLength);
             ans = ans.slice(0, minLength);
         }

        console.log(`Starting analysis for ${qs.length} answers...`);
        const feedbackPromises = qs.map((question, index) => {
            const answer = ans[index] || "";
            // Add a small delay between starting API calls to potentially avoid rate limits
            return new Promise(resolve => setTimeout(resolve, index * 50)).then(() => // 50ms stagger
                 getAnswerFeedbackFromGemini(question, answer, index + 1, currentJobRole) // Pass job role
            );
        });

        const results = await Promise.allSettled(feedbackPromises);
        console.log("All analysis API calls settled.");

        const finalFeedback = results.map((result, index) => {
            if (result.status === 'fulfilled') {
                console.log(`Analysis successful for Q${index + 1}`);
                return result.value; // Contains analysis, suggestion, grammarNotes, exampleAnswer
            } else {
                console.error(`Failed to get feedback for Q${index + 1}:`, result.reason);
                return { error: `Feedback generation failed. Reason: ${result.reason?.message || 'Unknown API error'}` };
            }
        });

        const overallSuccess = finalFeedback.every(fb => fb && !fb.error);
        console.log(`Overall analysis success: ${overallSuccess}`);

        return finalFeedback; // Return array of feedback/error objects
    }

    // ***********************************************************************
    // *         UPDATED getAnswerFeedbackFromGemini Function                *
    // ***********************************************************************
    async function getAnswerFeedbackFromGemini(question, answer, questionNum, jobRole) {
        // console.log(`Requesting feedback for Q${questionNum}...`);

        if (!answer || answer.trim().length < 5) { // Handle very short/empty answers
            console.log(`Q${questionNum}: No significant answer provided. Skipping API call.`);
            return {
                analysis: "No answer was provided or the answer was too short for analysis.",
                suggestion: "N/A",
                grammarNotes: "N/A",
                exampleAnswer: "N/A"
            };
        }

        // --- ENHANCED Prompt ---
        const prompt = `
        Analyze the following interview answer provided for a "${jobRole || 'General'}" role interview. Base the analysis ONLY on the provided question and answer text.

        Interview Question:
        "${question}"

        Candidate's Answer:
        "${answer}"

        Provide feedback in FOUR distinct parts:
        1.  **Analysis:** Briefly evaluate the answer's clarity, structure (e.g., STAR method if applicable), and directness in addressing the question. Keep concise (max 3 sentences).
        2.  **Suggestion:** Offer one brief, actionable suggestion for how the candidate could make the answer clearer, more impactful, or better structured for this type of question. Keep concise (max 2 sentences).
        3.  **Grammar & Phrasing Notes:** Identify 1-2 specific examples of noticeable grammatical errors or awkward phrasing in the candidate's answer. Quote the problematic phrase briefly and suggest a correction if simple (e.g., "'I has went' - should be 'I have gone'"). If grammar and phrasing are generally good, state "Grammar and phrasing appear sound." Keep very brief.
        4.  **Example Answer Approach:** Provide a brief example (2-4 sentences) illustrating a strong structural approach or key points to cover when answering the *original question*, considering the context of a "${jobRole || 'General'}" interview. This is an illustrative example of structure/content, not the only correct answer.

        Format your response EXACTLY like this, using Markdown bold for labels:

        **Analysis:** [Your analysis here]
        **Suggestion:** [Your suggestion here]
        **Grammar & Phrasing Notes:** [Your notes here, or "Grammar and phrasing appear sound."]
        **Example Answer Approach:** [Your example answer structure/points here]

        Do NOT add any introductory/concluding remarks, greetings, or apologies. Just provide the four labeled parts.
        `;

        try {
            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    // Adjusted config: slightly higher temp for more varied examples, more tokens
                    generationConfig: { temperature: 0.6, maxOutputTokens: 500 },
                    safetySettings: [
                       { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                       { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                       { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                       { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                     ]
                })
            });

             if (!response.ok) {
                 const errorBody = await response.text();
                 console.error(`Gemini feedback API Error (Q${questionNum}) Status: ${response.status} Body:`, errorBody.substring(0, 500));
                 let errorMessage = `API Error ${response.status}`;
                 try { errorMessage = JSON.parse(errorBody)?.error?.message || errorMessage; } catch (e) {}
                 throw new Error(errorMessage);
             }

            const data = await response.json();
            const candidate = data?.candidates?.[0];

            if (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
                 console.warn(`Gemini feedback generation (Q${questionNum}) finished unexpectedly: ${candidate.finishReason}`);
                 let reason = candidate.finishReason;
                 if (candidate.finishReason === "SAFETY") {
                     console.error(`AI feedback response (Q${questionNum}) blocked due to safety settings.`);
                     reason = "Blocked by safety filter";
                 }
                 throw new Error(`AI Generation Issue (${reason})`);
             }

            const generatedText = candidate?.content?.parts?.[0]?.text;
            if (generatedText) {
                // --- Enhanced Parsing Logic ---
                let analysis = "Could not parse Analysis.";
                let suggestion = "Could not parse Suggestion.";
                let grammarNotes = "Could not parse Grammar Notes.";
                let exampleAnswer = "Could not parse Example Answer.";

                // Use regex to find each labeled section, capturing content until the next label or end of string
                const analysisMatch = generatedText.match(/\*\*Analysis:\*\*\s*([\s\S]*?)(?=\n\*\*Suggestion:\*\*|\n\*\*Grammar & Phrasing Notes:\*\*|\n\*\*Example Answer Approach:\*\*|$)/);
                const suggestionMatch = generatedText.match(/\*\*Suggestion:\*\*\s*([\s\S]*?)(?=\n\*\*Grammar & Phrasing Notes:\*\*|\n\*\*Example Answer Approach:\*\*|$)/);
                const grammarMatch = generatedText.match(/\*\*Grammar & Phrasing Notes:\*\*\s*([\s\S]*?)(?=\n\*\*Example Answer Approach:\*\*|$)/);
                const exampleMatch = generatedText.match(/\*\*Example Answer Approach:\*\*\s*([\s\S]*?)$/); // Match to end

                if (analysisMatch && analysisMatch[1]) analysis = analysisMatch[1].trim();
                if (suggestionMatch && suggestionMatch[1]) suggestion = suggestionMatch[1].trim();
                if (grammarMatch && grammarMatch[1]) grammarNotes = grammarMatch[1].trim();
                if (!grammarNotes.includes("parse")) { // Basic check if parsing seems to have worked
                    console.log(`Q${questionNum}: Grammar Notes found.`);
                } else {
                    console.warn(`Q${questionNum}: Could not parse 'Grammar & Phrasing Notes:' block robustly.`);
                }
                if (exampleMatch && exampleMatch[1]) exampleAnswer = exampleMatch[1].trim();
                 if (!exampleAnswer.includes("parse")) {
                    console.log(`Q${questionNum}: Example Answer found.`);
                } else {
                    console.warn(`Q${questionNum}: Could not parse 'Example Answer Approach:' block robustly.`);
                }

                 // Fallback if specific parsing failed, assign whole text to analysis? (Less ideal)
                if (analysis.startsWith("Could not parse") && generatedText.length > 10) {
                    console.warn(`Q${questionNum}: Primary parsing failed. Assigning raw text to analysis as fallback.`);
                    analysis = generatedText; // Put everything in analysis if specific parsing fails
                    suggestion = "Parsing Error";
                    grammarNotes = "Parsing Error";
                    exampleAnswer = "Parsing Error";
                }


                console.log(`Q${questionNum} Feedback Parsed: Analysis='${analysis.substring(0,30)}...', Suggestion='${suggestion.substring(0,30)}...', Grammar='${grammarNotes.substring(0,30)}...', Example='${exampleAnswer.substring(0,30)}...'`);
                return { analysis, suggestion, grammarNotes, exampleAnswer };

            } else {
                 console.error(`No text content found in Gemini feedback response (Q${questionNum})`);
                 throw new Error("No text content received from AI");
            }

        } catch (error) {
             console.error(`Error in getAnswerFeedbackFromGemini for Q${questionNum}:`, error);
             throw error; // Re-throw for Promise.allSettled
        }
    }
     // ***********************************************************************
     // *       END OF UPDATED getAnswerFeedbackFromGemini Function           *
     // ***********************************************************************


    // --- PDF Generation (Using jsPDF) ---
    // ***********************************************************************
    // *             UPDATED generatePDF Function                            *
    // ***********************************************************************
    function generatePDF() {
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
            console.error("jsPDF library is not loaded!");
            alert("Error: Could not generate PDF. jsPDF library is missing.");
            if(downloadPdfBtn) downloadPdfBtn.innerText = "PDF Error";
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        console.log("jsPDF initialized for PDF generation.");

        try {
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 15;
            const contentWidth = pageWidth - (margin * 2);
            let yPos = 20;
            const lineSpacingFactor = 1.4; // Multiplier for line height
            const sectionSpacing = 7; // Increased spacing between major sections
            const qaBlockSpacing = 5;   // Increased spacing between Q/A blocks
            const feedbackIndent = 5;
            const feedbackItemSpacing = 2; // Space between Analysis/Suggestion/Grammar/Example

            // Helper function to add text and handle pagination
             const addText = (text, x, y, options = {}, size = 10, style = 'normal') => {
                 doc.setFontSize(size);
                 doc.setFont(undefined, style);
                 const lines = doc.splitTextToSize(text || '(N/A)', contentWidth - (x - margin)); // Use N/A for null/empty
                 const lineHeight = doc.getLineHeight(text) / doc.internal.scaleFactor;
                 const textHeight = lines.length * lineHeight * lineSpacingFactor;

                 if (y + textHeight > pageHeight - margin) {
                     doc.addPage();
                     yPos = margin;
                     y = yPos;
                     console.log("Added new page in PDF.");
                 }
                 doc.text(lines, x, y, options);
                 yPos = y + textHeight; // Update global yPos
                 return yPos; // Return the updated global yPos
             };

            // --- PDF Content ---
            // 1. Title
            doc.setFontSize(18);
            doc.setFont(undefined, 'bold');
            doc.text("Interview Summary & Feedback Report", pageWidth / 2, yPos, { align: 'center' });
            yPos += sectionSpacing * 1.5;

            // 2. Interview Info
            const roleDisplay = currentJobRole || 'General Interview';
            yPos = addText(`Interview Type: ${roleDisplay}`, margin, yPos, {}, 12, 'bold');
            if (atsScore !== null) {
                yPos = addText(`Simulated ATS Score: ${atsScore}%`, margin, yPos + 1, {}, 11);
            }
            yPos += sectionSpacing;

            // 3. ATS Tips (if available)
            if (atsTips && atsTips.trim()) {
                 yPos = addText("Resume Improvement Tips (Simulated ATS):", margin, yPos, {}, 11, 'bold');
                 yPos = addText(atsTips, margin, yPos + 1, {}, 9);
                 yPos += sectionSpacing;
            }

            // 4. Questions, Answers, and Enhanced Feedback
             yPos = addText("Interview Questions & Detailed Analysis:", margin, yPos, {}, 12, 'bold');
             yPos += 3; // Little more space after header

            if (!questions || questions.length === 0 || !Array.isArray(questions)) {
                 yPos = addText("No questions were asked or recorded in this session.", margin, yPos, {}, 10, 'italic');
             } else {
                questions.forEach((question, index) => {
                    const qText = `Q${index + 1}: ${question}`;
                    const aText = (answers && answers[index]) || '(No answer recorded)';
                     // Ensure answerFeedback is an array and has an entry for this index
                    const feedback = (Array.isArray(answerFeedback) && answerFeedback[index]) ? answerFeedback[index] : { error: "Feedback data missing" };

                    // Check remaining space before starting Q/A block
                    const estimatedBlockHeight = 60; // Rough estimate for a Q/A block with all feedback
                    if (yPos + estimatedBlockHeight > pageHeight - margin) {
                        doc.addPage();
                        yPos = margin;
                        console.log("Added new page before Q/A block.");
                        // Re-add section header if it's the first item on a new page
                        yPos = addText("Interview Questions & Detailed Analysis (Continued):", margin, yPos, {}, 12, 'bold');
                        yPos += 3;
                    }


                    // --- Print Question ---
                    yPos = addText(qText, margin, yPos, {}, 10, 'bold');
                    yPos += 1;

                    // --- Print Answer ---
                    yPos = addText(`Answer: ${aText}`, margin + feedbackIndent, yPos, {}, 9);
                    yPos += feedbackItemSpacing + 1; // More space before feedback section

                    // --- Print Feedback Section ---
                    if (feedback) {
                         if (feedback.error) {
                             yPos = addText(`Feedback Status: ${feedback.error}`, margin + feedbackIndent, yPos, { textColor: '#D32F2F' }, 9, 'italic');
                         } else {
                             // Display Analysis
                             yPos = addText(`Analysis:`, margin + feedbackIndent, yPos, {}, 9, 'bolditalic');
                             yPos = addText(feedback.analysis || 'N/A', margin + feedbackIndent + 2, yPos, { maxWidth: contentWidth - feedbackIndent - 2 }, 9, 'italic');
                             yPos += feedbackItemSpacing;

                             // Display Suggestion
                             yPos = addText(`Suggestion:`, margin + feedbackIndent, yPos, {}, 9, 'bolditalic');
                             yPos = addText(feedback.suggestion || 'N/A', margin + feedbackIndent + 2, yPos, { maxWidth: contentWidth - feedbackIndent - 2 }, 9, 'italic');
                             yPos += feedbackItemSpacing;

                             // --- NEW: Display Grammar Notes ---
                             yPos = addText(`Grammar & Phrasing:`, margin + feedbackIndent, yPos, {}, 9, 'bolditalic');
                             yPos = addText(feedback.grammarNotes || 'N/A', margin + feedbackIndent + 2, yPos, { maxWidth: contentWidth - feedbackIndent - 2 }, 9, 'italic');
                             yPos += feedbackItemSpacing;

                             // --- NEW: Display Example Answer Approach ---
                             yPos = addText(`Example Answer Approach:`, margin + feedbackIndent, yPos, {}, 9, 'bolditalic');
                             yPos = addText(feedback.exampleAnswer || 'N/A', margin + feedbackIndent + 2, yPos, { maxWidth: contentWidth - feedbackIndent - 2 }, 9, 'italic');
                             // No extra spacing needed after the last item
                         }
                     } else {
                        yPos = addText(`(Feedback data not available)`, margin + feedbackIndent, yPos, { textColor: '#888888' }, 9, 'italic');
                     }
                     yPos += qaBlockSpacing; // Add spacing AFTER the entire Q/A/Feedback block
                });
             }

            // 5. Add User's General Feedback (if provided)
            const currentUserFeedback = document.getElementById('feedback')?.value || feedbackText;
            if (currentUserFeedback && currentUserFeedback.trim()) {
                // Check space before adding feedback section
                const estimatedFeedbackHeight = 30;
                if (yPos + estimatedFeedbackHeight > pageHeight - margin) {
                    doc.addPage();
                    yPos = margin;
                }
                 yPos += sectionSpacing / 2;
                 yPos = addText("User's General Feedback:", margin, yPos, {}, 11, 'bold');
                 yPos = addText(currentUserFeedback, margin, yPos + 1, {}, 9);
            }

            // --- Save the PDF ---
            doc.save('Interview_Summary_Feedback_Report.pdf'); // Updated filename
            console.log("PDF generated and download should initiate.");
            if(downloadPdfBtn) downloadPdfBtn.innerText = "Download PDF Report";

        } catch (e) {
            console.error("Error generating or saving PDF:", e);
            alert(`An error occurred while generating the PDF: ${e.message}. Please check the console for details.`);
            if(downloadPdfBtn) downloadPdfBtn.innerText = "PDF Generation Failed";
        }
    }
     // ***********************************************************************
     // *             END OF UPDATED generatePDF Function                     *
     // ***********************************************************************


    // --- Initialization and Reset Functions ---

    // resetInterviewState remains the same
    function resetInterviewState() {
        questions = [];
        answers = [];
        answerFeedback = [];
        currentQuestionIndex = 0;
        feedbackText = '';
        atsScore = null;
        atsTips = '';
        resumeTextContent = '';
        isAnalyzingAnswers = false;
        recognitionActive = false;
        isSpeaking = false;
        // Don't reset currentJobRole
    }

    // resetToUploadState remains the same
    function resetToUploadState() {
         console.log("Resetting UI to upload state.");
         resetInterviewState(); // Clear state

         // Stop processes
          if (typeof recognition !== 'undefined') { try { recognition.abort(); } catch(e){} }
          if ('speechSynthesis' in window) { speechSynthesis.cancel(); }
          if (video) video.pause();

         // Reset UI Visibility
         if(container) container.style.display = 'none';
         if(postInterviewSection) postInterviewSection.style.display = 'none';
         if(atsDisplaySection) atsDisplaySection.style.display = 'none';
         if(feedbackGenerationStatus) feedbackGenerationStatus.style.display = 'none';
         if(uploadSection) uploadSection.style.display = 'block';
         hideLoading();

         // Reset Button States
         if(startBtn) startBtn.disabled = false;
         if(stopBtn) stopBtn.disabled = true;
         if(answerCompleteBtn) answerCompleteBtn.disabled = true;
         if(proceedInterviewBtn) proceedInterviewBtn.disabled = true;
         if(downloadPdfBtn) downloadPdfBtn.style.display = 'none'; // Hide download btn initially
         if(downloadButtonDiv) downloadButtonDiv.style.display = 'none'; // Hide container div
         if(submitFeedbackBtn) {
            submitFeedbackBtn.disabled = false;
            submitFeedbackBtn.innerText = "Submit Feedback";
         }

         // Clear Inputs
         if(resumeFileInput) resumeFileInput.value = '';
         const feedbackInput = document.getElementById('feedback');
         if (feedbackInput) feedbackInput.value = '';

         console.log("UI and state reset complete.");
    }


    // initialize remains mostly the same
    function initialize() {
        console.log("Initializing Virtual AI Interviewer...");
        resetToUploadState(); // Start clean

        if (!window.SpeechRecognition) {
            console.error("FATAL: Speech Recognition API is not supported.");
            if(uploadSection) uploadSection.innerHTML = '<p style="color:red; font-weight:bold;">Your browser does not support Speech Recognition, which is required for this tool. Please use Google Chrome or Microsoft Edge.</p>';
            if(startBtn) startBtn.disabled = true;
            if(jobRoleSelect) jobRoleSelect.disabled = true;
            if(resumeFileInput) resumeFileInput.disabled = true;
            return;
        }
        if (!('speechSynthesis' in window)) {
            console.warn("Speech Synthesis not available. AI will not speak.");
        } else {
             if (speechSynthesis.getVoices().length === 0) {
                speechSynthesis.addEventListener('voiceschanged', () => {
                    console.log("Speech Synthesis voices loaded:", speechSynthesis.getVoices().length);
                }, { once: true });
            } else {
                 console.log("Speech Synthesis voices already available:", speechSynthesis.getVoices().length);
            }
        }

        // Populate job role dropdown (logic remains same)
        if (jobRoleSelect && jobRoleSelect.options.length <= 1) {
            console.log("Populating job role dropdown.");
            const defaultOption = jobRoleSelect.querySelector('option[value=""]');
            if (!defaultOption) {
                 const defOpt = document.createElement('option');
                 defOpt.value = "";
                 defOpt.textContent = "-- Select Interview Type --";
                 defOpt.disabled = true;
                 defOpt.selected = true;
                 jobRoleSelect.appendChild(defOpt);
            }
             const roles = [
                'Resume Based Interview',
                'HR Interview',
                'Software Development Technical Interview',
                'ML Technical Interview',
                'Application Development Technical Interview',
                'Data Analyst Interview',
                'Project Manager Interview'
             ];
             roles.forEach(role => {
                 if (!jobRoleSelect.querySelector(`option[value="${role}"]`)) {
                    const option = document.createElement('option');
                    option.value = role;
                    option.textContent = role;
                    jobRoleSelect.appendChild(option);
                 }
             });
        }

        console.log("Initialization Complete.");
    }

    // Run initialization when the page loads
    window.addEventListener('load', initialize);

} // End of check for window.SpeechRecognition support block
