const texts = document.querySelector('.texts');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const answerCompleteBtn = document.getElementById('answerComplete');
const thankYouMessage = document.getElementById('thankYouMessage');
const feedbackBlock = document.getElementById('feedbackBlock');
const uploadSection = document.getElementById('uploadSection');
const container = document.getElementById('container');
const submitFeedbackBtn = document.getElementById('submitFeedback');
const downloadButton = document.getElementById('downloadButton');
const video = document.getElementById('backgroundVideo'); // Ensure this ID matches your video element
const audio = new Audio('greeting.mp3'); // Ensure this path is correct for your greeting sound file

let questions = [];
let answers = [];
let currentQuestionIndex = 0;
let isAnswerComplete = false;
let recognitionActive = false;
let feedback = '';

window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.addEventListener('result', (e) => {
  const text = Array.from(e.results)
    .map(result => result[0])
    .map(result => result.transcript)
    .join('');

  if (e.results[0].isFinal) {
    displayQuestionAnswer(questions[currentQuestionIndex], text);
    answers.push(text);
    isAnswerComplete = true;
    recognition.stop();
  }
});

recognition.addEventListener('end', () => {
  if (recognitionActive && !isAnswerComplete) recognition.start();
});

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = speechSynthesis.getVoices().find(voice => voice.name.includes('Google UK English Female'));
  speechSynthesis.speak(utterance);
}

function displayQuestionAnswer(question, answer) {
  texts.innerHTML = ''; // Clear previous question and answer
  const questionElem = document.createElement('p');
  questionElem.classList.add('question');
  questionElem.innerText = `Q: ${question}`;
  texts.appendChild(questionElem);

  const answerElem = document.createElement('p');
  answerElem.classList.add('answer');
  answerElem.innerText = `A: ${answer}`;
  texts.appendChild(answerElem);
}

function playGreeting() {
  audio.play();
  const greetingUtterance = new SpeechSynthesisUtterance("Hi, my name is Lisa. I am here to take your interview.");
  greetingUtterance.voice = speechSynthesis.getVoices().find(voice => voice.name.includes('Google UK English Female'));
  speechSynthesis.speak(greetingUtterance);
}

startBtn.addEventListener('click', () => {
  const resume = document.getElementById('resume').files[0];
  const jobRole = document.getElementById('jobRole').value;

  if (!resume || !jobRole) {
    alert('Please upload your resume and select the job role.');
    return;
  }

  uploadSection.style.display = 'none';
  container.style.display = 'block';

  playGreeting(); // Play greeting when starting the interview
  setTimeout(() => {
    startInterview(jobRole); // Start the interview after greeting
  }, 4000); // 4-second greeting

  // Disable buttons
  startBtn.disabled = true;
  stopBtn.disabled = false;
  answerCompleteBtn.disabled = false;
});

stopBtn.addEventListener('click', () => {
  recognitionActive = false;
  recognition.stop();
  video.pause(); // Pause video when interview stops
  video.currentTime = 0; // Reset video to start
  texts.innerHTML = '';
  thankYouMessage.innerText = 'Thank you for participating!';
  thankYouMessage.style.display = 'block';
  feedbackBlock.style.display = 'block';
  generatePDF(); // Generate the PDF document at the end
  startBtn.disabled = false;
  stopBtn.disabled = true;
  answerCompleteBtn.disabled = true;
  downloadButton.style.display = 'block'; // Show download button
});

answerCompleteBtn.addEventListener('click', () => {
  if (isAnswerComplete) {
    isAnswerComplete = false;
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
      askNextQuestion();
      video.play(); // Play video when moving to the next question
      setTimeout(() => {
        video.pause(); // Pause video after 4 seconds
      }, 4000);
      recognition.start();
    } else {
      stopBtn.click();
    }
  }
});

submitFeedbackBtn.addEventListener('click', () => {
  feedback = document.getElementById('feedback').value;
  alert('Thank you for your feedback!');
  // You can send this feedback to a server or handle it as needed
});

downloadButton.addEventListener('click', () => {
  generatePDF();
});

function startInterview(jobRole) {
  questions = getQuestionsForJobRole(jobRole);
  answers = [];
  if (questions.length > 0) {
    currentQuestionIndex = 0;
    recognitionActive = true;
    askNextQuestion();
    video.play(); // Start video when interview starts
    setTimeout(() => {
      video.pause(); // Pause video after 4 seconds
    }, 4000);
    recognition.start();
  } else {
    alert('No questions found for the specified job role.');
  }
}

function askNextQuestion() {
  if (currentQuestionIndex < questions.length) {
    speak(questions[currentQuestionIndex]);
    displayQuestionAnswer(questions[currentQuestionIndex], ''); // Display the new question
  }
}

function getQuestionsForJobRole(role) {
  const questionsForRoles = {
    'hr interview': [
      'Tell me about yourself.',
      'What programming languages are you most comfortable with?',
      'How do you handle debugging in your code?',
      'How do you deal with criticism?',
      'Why do you want to work for our company?',
      'What are your greatest strengths and weaknesses?',
      'Why are you looking for a change?',
      'How would you rate yourself on a scale of 1 to 10?',
      'What is your biggest achievement so far?',
      'Where do you see yourself in 5 years?',
      'Why should we hire you?'
    ],
    'software development technical interview': [
      'What is baseline in Software Development?',
      'What do you mean by Software Re-engineering?',
      'What are CASE tools?',
      'What is SRS?',
      'What is Software prototyping and POC?',
      'What is the waterfall method and what are its use cases?',
      'What is Debugging?',
      'Which SDLC model is the best?',
      'What is the difference between Quality Assurance and Quality control?',
      'Define black box testing and white box testing?'
    ],
    'ml technical interview': [
      'What are Different Kernels in SVM?',
      'Why was Machine Learning Introduced?',
      'Explain the Difference Between Classification and Regression?',
      'What is Bias in Machine Learning?',
      'What is Cross-Validation?',
      'What is ‘Naive’ in a Naive Bayes?',
      'What is Unsupervised Learning?',
      'Define Precision and Recall?'
    ],
    'application development technical interview': [
      'What resources do you use to research a solution to a complex programming problem?',
      'What techniques do you use to migrate an application from one platform to another with a different operating system?',
      'How do you stay up to date on technology and industry development?',
      'How do web applications differ from mobile applications?',
      'What are black-box, grey-box and white-box testing?',
      'What are the three main categories of defects in an application?'
    ]
  };
  return questionsForRoles[role.toLowerCase()] || [];
}

function generatePDF() {
  const doc = new jsPDF();
  doc.setFontSize(12);
  questions.forEach((question, index) => {
    doc.text(`Q: ${question}`, 10, 10 + (index * 10));
    doc.text(`A: ${answers[index] || ''}`, 10, 15 + (index * 10));
  });

  doc.text("For Better answers, visit the following links:", 10, 100);
  const links = {
    'hr interview': "https://www.interviewbit.com/hr-interview-questions/",
    'software development technical interview': "https://www.interviewbit.com/software-engineering-interview-questions/",
    'ml technical interview': "https://www.interviewbit.com/machine-learning-interview-questions/",
    'application development technical interview': "https://in.indeed.com/career-advice/interviewing/application-developer-interview-questions"
  };
  doc.text(links[document.getElementById('jobRole').value.toLowerCase()] || '', 10, 110);
  doc.save('Interview_Summary.pdf');
}
