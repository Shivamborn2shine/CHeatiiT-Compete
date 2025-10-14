// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
apiKey: "AIzaSyBqQbWY6VwENxf6ZBFwqQ1y3mI_AERvgoI",
authDomain: "cheatiit-7a04b.firebaseapp.com",
databaseURL: "https://cheatiit-7a04b-default-rtdb.firebaseio.com",
projectId: "cheatiit-7a04b",
storageBucket: "cheatiit-7a04b.firebasestorage.app",
messagingSenderId: "286680049163",
appId: "1:286680049163:web:71488c9ac0699318a5490e",
measurementId: "G-FR5YZN6SVC"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM Elements
const homeView = document.getElementById('home-view');
const presenterView = document.getElementById('presenter-view');
const participantView = document.getElementById('participant-view');

const joinCodeInput = document.getElementById('join-code');
const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const createBtn = document.getElementById('create-btn');

const presenterCode = document.getElementById('presenter-code');
const quizTitleInput = document.getElementById('quiz-title');
const questionsContainer = document.getElementById('questions-container');
const addQuestionBtn = document.getElementById('add-question-btn');
const startQuizBtn = document.getElementById('start-quiz-btn');
const liveResults = document.getElementById('live-results');

const participantQuizTitle = document.getElementById('participant-quiz-title');
const waitingScreen = document.getElementById('waiting-screen');
const questionScreen = document.getElementById('question-screen');
const currentQuestion = document.getElementById('current-question');
const questionTimer = document.getElementById('question-timer');
const timerProgress = document.getElementById('timer-progress');
const optionsContainer = document.getElementById('options-container');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const answerSubmitted = document.getElementById('answer-submitted');
const resultsScreen = document.getElementById('results-screen');
const participantResultsChart = document.getElementById('participant-results-chart');
const participantLeaderboard = document.getElementById('participant-leaderboard');

// Application State
let currentUser = null;
let currentQuizId = null;
let currentQuestionIndex = 0;
let selectedOption = null;
let timerInterval = null;
let timeLeft = 30;

// Generate a random quiz code
function generateQuizCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Switch between views
function showView(view) {
    homeView.classList.remove('active');
    presenterView.classList.remove('active');
    participantView.classList.remove('active');
    view.classList.add('active');
}

// Create a new quiz
createBtn.addEventListener('click', () => {
    currentQuizId = generateQuizCode();
    presenterCode.textContent = currentQuizId;
    
    // Initialize quiz in Firebase
    database.ref('quizzes/' + currentQuizId).set({
        title: 'My Quiz',
        status: 'waiting',
        currentQuestion: 0,
        questions: []
    });
    
    showView(presenterView);
    addQuestion(); // Add first question by default
});

// Add a new question to the quiz
addQuestionBtn.addEventListener('click', addQuestion);

function addQuestion() {
    const questionIndex = questionsContainer.children.length;
    const questionDiv = document.createElement('div');
    questionDiv.className = 'card';
    questionDiv.innerHTML = `
        <h3>Question ${questionIndex + 1}</h3>
        <div class="form-group">
            <label>Question Text</label>
            <input type="text" class="question-text" placeholder="Enter your question">
        </div>
        <div class="form-group">
            <label>Options</label>
            <input type="text" class="option-1" placeholder="Option 1">
            <input type="text" class="option-2" placeholder="Option 2">
            <input type="text" class="option-3" placeholder="Option 3">
            <input type="text" class="option-4" placeholder="Option 4">
        </div>
        <div class="form-group">
            <label>Correct Answer</label>
            <select class="correct-answer">
                <option value="0">Option 1</option>
                <option value="1">Option 2</option>
                <option value="2">Option 3</option>
                <option value="3">Option 4</option>
            </select>
        </div>
        <div class="form-group">
            <label>Time Limit (seconds)</label>
            <input type="number" class="time-limit" value="30" min="10" max="120">
        </div>
        <button class="btn btn-danger remove-question-btn">Remove Question</button>
    `;
    
    questionsContainer.appendChild(questionDiv);
    
    // Add event listener to remove button
    questionDiv.querySelector('.remove-question-btn').addEventListener('click', () => {
        questionDiv.remove();
    });
}

// Start the quiz
startQuizBtn.addEventListener('click', () => {
    const title = quizTitleInput.value || 'My Quiz';
    const questions = [];
    
    // Collect all questions
    const questionElements = questionsContainer.querySelectorAll('.card');
    questionElements.forEach((element, index) => {
        const questionText = element.querySelector('.question-text').value || `Question ${index + 1}`;
        const options = [
            element.querySelector('.option-1').value || 'Option 1',
            element.querySelector('.option-2').value || 'Option 2',
            element.querySelector('.option-3').value || 'Option 3',
            element.querySelector('.option-4').value || 'Option 4'
        ];
        const correctAnswer = parseInt(element.querySelector('.correct-answer').value);
        const timeLimit = parseInt(element.querySelector('.time-limit').value) || 30;
        
        questions.push({
            text: questionText,
            options: options,
            correctAnswer: correctAnswer,
            timeLimit: timeLimit
        });
    });
    
    // Update quiz in Firebase
    database.ref('quizzes/' + currentQuizId).update({
        title: title,
        status: 'active',
        currentQuestion: 0,
        questions: questions,
        participants: {},
        results: {}
    });
    
    // Show live results
    liveResults.classList.remove('hidden');
    
    // Listen for participant answers
    database.ref('quizzes/' + currentQuizId + '/participants').on('value', (snapshot) => {
        updateLeaderboard(snapshot.val());
    });
    
    // Start the first question
    startQuestion(0);
});

// Start a specific question
function startQuestion(questionIndex) {
    database.ref('quizzes/' + currentQuizId).once('value').then((snapshot) => {
        const quiz = snapshot.val();
        const question = quiz.questions[questionIndex];
        
        // Update current question in Firebase
        database.ref('quizzes/' + currentQuizId).update({
            currentQuestion: questionIndex,
            questionStartTime: Date.now(),
            answers: {}
        });
        
        // Display question for presenter
        displayQuestionResults(question, questionIndex);
        
        // Set up timer
        timeLeft = question.timeLimit;
        updateTimerDisplay();
        
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                endQuestion(questionIndex);
            }
        }, 1000);
    });
}

// Update timer display
function updateTimerDisplay() {
    const progressPercent = (timeLeft / 30) * 100;
    timerProgress.style.width = `${progressPercent}%`;
    questionTimer.textContent = `Time left: ${timeLeft}s`;
}

// End the current question
function endQuestion(questionIndex) {
    clearInterval(timerInterval);
    
    database.ref('quizzes/' + currentQuizId).once('value').then((snapshot) => {
        const quiz = snapshot.val();
        const question = quiz.questions[questionIndex];
        
        // Calculate results
        const answers = quiz.answers || {};
        const results = {};
        
        // Initialize results
        question.options.forEach((_, index) => {
            results[index] = 0;
        });
        
        // Count answers
        Object.values(answers).forEach(answer => {
            if (results[answer] !== undefined) {
                results[answer]++;
            }
        });
        
        // Update results in Firebase
        database.ref('quizzes/' + currentQuizId + '/results').update({
            [questionIndex]: results
        });
        
        // Update participant scores
        Object.entries(answers).forEach(([participantId, answer]) => {
            const isCorrect = answer === question.correctAnswer;
            const currentScore = quiz.participants[participantId]?.score || 0;
            
            if (isCorrect) {
                database.ref('quizzes/' + currentQuizId + '/participants/' + participantId).update({
                    score: currentScore + 1
                });
            }
        });
        
        // Move to next question after a delay
        setTimeout(() => {
            if (questionIndex < quiz.questions.length - 1) {
                startQuestion(questionIndex + 1);
            } else {
                // Quiz ended
                database.ref('quizzes/' + currentQuizId).update({
                    status: 'ended'
                });
            }
        }, 5000);
    });
}

// Display question results for presenter
function displayQuestionResults(question, questionIndex) {
    const resultsChart = document.getElementById('results-chart');
    resultsChart.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = '0px';
        bar.innerHTML = `
            <div class="chart-value">0</div>
            <div class="chart-label">${option}</div>
        `;
        resultsChart.appendChild(bar);
    });
    
    // Listen for results updates
    database.ref('quizzes/' + currentQuizId + '/results/' + questionIndex).on('value', (snapshot) => {
        const results = snapshot.val() || {};
        const totalAnswers = Object.values(results).reduce((sum, count) => sum + count, 0);
        const maxCount = Math.max(...Object.values(results), 1);
        
        question.options.forEach((option, index) => {
            const count = results[index] || 0;
            const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0;
            const barHeight = (count / maxCount) * 250;
            
            const bar = resultsChart.children[index];
            bar.style.height = `${barHeight}px`;
            bar.querySelector('.chart-value').textContent = count;
            
            // Highlight correct answer
            if (index === question.correctAnswer) {
                bar.style.background = 'linear-gradient(to top, #4CAF50, #8BC34A)';
            }
        });
    });
}

// Update leaderboard
function updateLeaderboard(participants) {
    const leaderboard = document.getElementById('leaderboard');
    leaderboard.innerHTML = '';
    
    if (!participants) return;
    
    // Convert to array and sort by score
    const sortedParticipants = Object.entries(participants)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.score - a.score);
    
    // Create podium for top 3
    const podium = document.createElement('div');
    podium.className = 'podium';
    
    // Add top 3 to podium
    sortedParticipants.slice(0, 3).forEach((participant, index) => {
        const podiumItem = document.createElement('div');
        podiumItem.className = `podium-item podium-${index + 1}`;
        podiumItem.innerHTML = `
            <div class="podium-rank">${index + 1}</div>
            <div class="podium-name">${participant.name}</div>
            <div class="podium-score">${participant.score} pts</div>
        `;
        podium.appendChild(podiumItem);
    });
    
    leaderboard.appendChild(podium);
    
    // Add the rest to the list
    sortedParticipants.forEach((participant, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="rank">${index + 1}</div>
            <div class="player-name">${participant.name}</div>
            <div class="player-score">${participant.score} pts</div>
        `;
        leaderboard.appendChild(item);
    });
}

// Join a quiz as participant
joinBtn.addEventListener('click', () => {
    const quizCode = joinCodeInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim();
    
    if (!quizCode || !playerName) {
        alert('Please enter both quiz code and your name');
        return;
    }
    
    // Check if quiz exists
    database.ref('quizzes/' + quizCode).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            currentQuizId = quizCode;
            currentUser = playerName;
            
            // Join the quiz
            const participantId = generateParticipantId();
            database.ref('quizzes/' + quizCode + '/participants/' + participantId).set({
                name: playerName,
                score: 0
            });
            
            // Show participant view
            showView(participantView);
            participantQuizTitle.textContent = snapshot.val().title || 'Quiz';
            
            // Listen for quiz updates
            database.ref('quizzes/' + quizCode).on('value', (quizSnapshot) => {
                const quiz = quizSnapshot.val();
                if (!quiz) return;
                
                if (quiz.status === 'active') {
                    waitingScreen.classList.add('hidden');
                    questionScreen.classList.remove('hidden');
                    
                    const currentQIndex = quiz.currentQuestion || 0;
                    const question = quiz.questions[currentQIndex];
                    
                    if (question) {
                        displayQuestionForParticipant(question, currentQIndex);
                    }
                } else if (quiz.status === 'ended') {
                    questionScreen.classList.add('hidden');
                    resultsScreen.classList.remove('hidden');
                    updateParticipantLeaderboard(quiz.participants);
                }
            });
            
            // Listen for results
            database.ref('quizzes/' + quizCode + '/results').on('value', (resultsSnapshot) => {
                const results = resultsSnapshot.val();
                if (results) {
                    displayParticipantResults(results);
                }
            });
        } else {
            alert('Quiz not found. Please check the code.');
        }
    });
});

// Generate a unique participant ID
function generateParticipantId() {
    return 'participant_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Display question for participant
function displayQuestionForParticipant(question, questionIndex) {
    currentQuestion.textContent = question.text;
    optionsContainer.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'option';
        optionElement.textContent = option;
        optionElement.dataset.index = index;
        
        optionElement.addEventListener('click', () => {
            // Deselect all options
            optionsContainer.querySelectorAll('.option').forEach(opt => {
                opt.classList.remove('selected');
            });
            
            // Select this option
            optionElement.classList.add('selected');
            selectedOption = index;
            submitAnswerBtn.classList.remove('hidden');
        });
        
        optionsContainer.appendChild(optionElement);
    });
    
    // Reset state
    selectedOption = null;
    submitAnswerBtn.classList.add('hidden');
    answerSubmitted.classList.add('hidden');
    
    // Start timer
    const questionStartTime = database.ref('quizzes/' + currentQuizId + '/questionStartTime');
    questionStartTime.once('value').then((snapshot) => {
        const startTime = snapshot.val() || Date.now();
        const elapsed = Date.now() - startTime;
        const timeLimit = question.timeLimit * 1000;
        timeLeft = Math.max(0, Math.floor((timeLimit - elapsed) / 1000));
        
        updateParticipantTimer();
        
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeLeft--;
            updateParticipantTimer();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                // Auto-submit if time runs out
                if (selectedOption !== null) {
                    submitAnswer();
                }
            }
        }, 1000);
    });
}

// Update participant timer display
function updateParticipantTimer() {
    const progressPercent = (timeLeft / 30) * 100;
    timerProgress.style.width = `${progressPercent}%`;
    questionTimer.textContent = `Time left: ${timeLeft}s`;
}

// Submit answer
submitAnswerBtn.addEventListener('click', submitAnswer);

function submitAnswer() {
    if (selectedOption === null) return;
    
    // Submit answer to Firebase
    const participantId = Object.keys(database.ref('quizzes/' + currentQuizId + '/participants')._path.pieces_).pop();
    database.ref('quizzes/' + currentQuizId + '/answers/' + participantId).set(selectedOption);
    
    // Show submitted message
    questionScreen.classList.add('hidden');
    answerSubmitted.classList.remove('hidden');
    
    clearInterval(timerInterval);
}

// Display results for participant
function displayParticipantResults(results) {
    participantResultsChart.innerHTML = '';
    
    database.ref('quizzes/' + currentQuizId).once('value').then((snapshot) => {
        const quiz = snapshot.val();
        const currentQIndex = quiz.currentQuestion || 0;
        const question = quiz.questions[currentQIndex];
        
        if (!question || !results[currentQIndex]) return;
        
        const questionResults = results[currentQIndex];
        const totalAnswers = Object.values(questionResults).reduce((sum, count) => sum + count, 0);
        const maxCount = Math.max(...Object.values(questionResults), 1);
        
        question.options.forEach((option, index) => {
            const count = questionResults[index] || 0;
            const barHeight = (count / maxCount) * 250;
            
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${barHeight}px`;
            bar.innerHTML = `
                <div class="chart-value">${count}</div>
                <div class="chart-label">${option}</div>
            `;
            
            // Highlight participant's answer
            const participantId = Object.keys(database.ref('quizzes/' + currentQuizId + '/participants')._path.pieces_).pop();
            const participantAnswer = quiz.answers?.[participantId];
            
            if (index === participantAnswer) {
                bar.style.border = '3px solid #f72585';
            }
            
            // Highlight correct answer
            if (index === question.correctAnswer) {
                bar.style.background = 'linear-gradient(to top, #4CAF50, #8BC34A)';
            }
            
            participantResultsChart.appendChild(bar);
        });
    });
}

// Update participant leaderboard
function updateParticipantLeaderboard(participants) {
    participantLeaderboard.innerHTML = '';
    
    if (!participants) return;
    
    // Convert to array and sort by score
    const sortedParticipants = Object.entries(participants)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.score - a.score);
    
    // Create podium for top 3
    const podium = document.createElement('div');
    podium.className = 'podium';
    
    // Add top 3 to podium
    sortedParticipants.slice(0, 3).forEach((participant, index) => {
        const podiumItem = document.createElement('div');
        podiumItem.className = `podium-item podium-${index + 1}`;
        podiumItem.innerHTML = `
            <div class="podium-rank">${index + 1}</div>
            <div class="podium-name">${participant.name}</div>
            <div class="podium-score">${participant.score} pts</div>
        `;
        podium.appendChild(podiumItem);
    });
    
    participantLeaderboard.appendChild(podium);
    
    // Add the rest to the list
    sortedParticipants.forEach((participant, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
            <div class="rank">${index + 1}</div>
            <div class="player-name">${participant.name}</div>
            <div class="player-score">${participant.score} pts</div>
        `;
        participantLeaderboard.appendChild(item);
    });
}
