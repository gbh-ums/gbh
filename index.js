document.addEventListener('DOMContentLoaded', () => {
    // --- 1. THEME MANAGEMENT ---
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const body = document.body;

    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'theme-light';
    // Menjaga class bawaan agar background tetap bergerak (moving-bg)
    body.className = `moving-bg min-h-screen flex flex-col overflow-x-hidden ${savedTheme}`;
    updateIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        if (body.classList.contains('theme-light')) {
            body.classList.replace('theme-light', 'theme-dark');
            localStorage.setItem('theme', 'theme-dark');
            updateIcon('theme-dark');
        } else {
            body.classList.replace('theme-dark', 'theme-light');
            localStorage.setItem('theme', 'theme-light');
            updateIcon('theme-light');
        }
    });

    function updateIcon(theme) {
        if (theme === 'theme-dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    // --- 2. TYPING EFFECT LOGIC ---
    const textElement = document.getElementById("typing-text");
const words = ["Gabah Nasional.", "Petani Lokal.", "Pangan Mandiri."];
    let wordIdx = 0, charIdx = 0, isDeleting = false;

    function type() {
        const currentWord = words[wordIdx];
        
        textElement.textContent = isDeleting 
            ? currentWord.substring(0, charIdx--) 
            : currentWord.substring(0, charIdx++);

        if (!isDeleting && charIdx > currentWord.length) {
            isDeleting = true;
            setTimeout(type, 2000); // Jeda saat kata selesai diketik
        } else if (isDeleting && charIdx < 0) {
            isDeleting = false;
            wordIdx = (wordIdx + 1) % words.length;
            charIdx = 0;
            setTimeout(type, 500); // Jeda sebelum mengetik kata baru
        } else {
            setTimeout(type, isDeleting ? 100 : 150);
        }
    }
    type();

    // --- 3. SCROLL REVEAL LOGIC (Menu Edukasi) ---
    const observerOptions = {
        threshold: 0.15 // Muncul saat 15% elemen terlihat di viewport
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Unobserve jika ingin animasi hanya sekali saja saat scroll pertama
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Mengambil semua elemen yang memiliki class 'reveal'
    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach((el) => observer.observe(el));
    
    console.log("G.A.B.A.H Ecosystem Loaded: Theme, Typing, and Reveal Ready.");
});