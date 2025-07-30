/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- CONFIGURATION ---
// REPLACE WITH YOUR GOOGLE SHEETS API KEY AND SPREADSHEET ID
// Fix: Explicitly type constants as string to allow comparisons with other string literals without type errors.
const GOOGLE_SHEETS_API_KEY: string = 'AIzaSyCgtYEXXzvUxYH9qtpaSFTmLkHdKTlHRmg'; // <--- UPDATE THIS WITH YOUR VALID GOOGLE SHEETS API KEY.
// Fix: Explicitly type constants as string to allow comparisons with other string literals without type errors.
const SPREADSHEET_ID: string = '10rm-DG6knR_1F6TIhMdEFSehRO26F_4Zuyb_uFCt4AA'; // <--- This ID seems correct.

// Sheet names (must match your Google Sheet tabs)
const PROFILE_SHEET = 'Profile';
const SKILLS_CORE_SHEET = 'SkillsCore';
const SKILLS_TECHNICAL_SHEET = 'SkillsTechnical';
const EXPERIENCE_SHEET = 'Experience';
const PROJECTS_SHEET = 'Projects';
const EDUCATION_SHEET = 'Education';
const AWARDS_SHEET = 'Awards';
const TESTIMONIALS_SHEET = 'Testimonials';

// CVSync State
let uploadedResumeFile: File | null = null;

// --- GEMINI API ---
// IMPORTANT: This application uses the Google Gemini API.
// The API_KEY environment variable (process.env.API_KEY) MUST be set with a valid Google Gemini API key.
let ai: GoogleGenAI | null = null;
try {
    if (process.env.API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
        console.warn("API_KEY environment variable not set for Gemini. CVSync feature will be limited or non-functional.");
    }
} catch (e) {
    console.error("Error initializing GoogleGenAI:", e);
}


// --- HELPER FUNCTIONS ---
async function fetchSheetData(sheetName: string): Promise<string[][]> {
    // Configuration checks
    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID' || SPREADSHEET_ID === '') {
        const msg = `CRITICAL: The Spreadsheet ID ('${SPREADSHEET_ID}') is a placeholder or empty. Please update SPREADSHEET_ID in index.tsx with your actual value.`;
        console.error(msg);
        throw new Error(msg);
    }

    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY' || GOOGLE_SHEETS_API_KEY === '') {
        const msg = `CRITICAL: The Google Sheets API Key ('${GOOGLE_SHEETS_API_KEY}') is a placeholder or empty. This will not work. Please update GOOGLE_SHEETS_API_KEY in index.tsx with a *valid* Google Sheets API Key.`;
        console.error(msg);
        throw new Error(msg);
    } else if (GOOGLE_SHEETS_API_KEY.startsWith('GOCSPX-')) { // Checks if it generally looks like a Client Secret
        const msg = `CRITICAL: The configured GOOGLE_SHEETS_API_KEY starts with 'GOCSPX-', indicating it is a Client Secret, not an API Key. This will not work. Please replace it with a valid Google Sheets API Key from the Google Cloud Console.`;
        console.error(msg);
        throw new Error(msg);
    }


    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${GOOGLE_SHEETS_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const responseBody = await response.text(); // Get response body for more details
            let detailedError = `Could not fetch data for sheet "${sheetName}". Status: ${response.status} ${response.statusText}. Response: ${responseBody}. `;
            if (response.status === 403) {
                detailedError += "This often means the Google Sheets API is not enabled for your project, the API key is invalid/restricted (e.g., wrong API, wrong website referrer), or the sheet is not public. Ensure you are using a proper Google Sheets API Key, not a Client Secret.";
            } else if (response.status === 400) {
                 detailedError += "This often indicates an 'API key not valid' error or a problem with the request itself (e.g. malformed Spreadsheet ID, though yours looks okay). Double-check your API Key in index.tsx.";
            } else if (response.status === 404) {
                 detailedError += `The spreadsheet with ID "${SPREADSHEET_ID}" or the sheet named "${sheetName}" might not be found. Ensure the Spreadsheet ID is correct and the sheet tab name matches exactly.`;
            }
            console.error(`Error fetching sheet ${sheetName}: ${response.statusText}`, responseBody);
            throw new Error(detailedError);
        }
        const data = await response.json();
        const values: string[][] = data.values || [];
        // Skip the first row (assumed to be headers)
        if (values.length > 0) {
            return values.slice(1);
        }
        return []; // Return empty if no data or only a header row (which gets sliced away)
    } catch (error) {
        console.error(`Exception during fetch or processing for sheet ${sheetName}:`, error);
        if (error instanceof Error && (error.message.startsWith("CRITICAL:") || error.message.includes("Could not fetch data"))) {
            throw error; // Re-throw our specific or detailed fetch errors
        }
        throw new Error(`Failed to fetch or process data for sheet "${sheetName}". Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function getProfileValue(profileData: string[][], key: string): string {
    const row = profileData.find(r => r && r[0] === key); // Added check for r
    return row && row[1] ? row[1].trim() : '';
}

// --- RENDERING FUNCTIONS ---
function renderProfile(profileData: string[][]) {
    document.getElementById('profileName')!.textContent = getProfileValue(profileData, 'Name') || 'Nitin Verma (Default)';
    document.getElementById('footerName')!.textContent = getProfileValue(profileData, 'Name') || 'Nitin Verma (Default)';
    document.getElementById('navLogoName')!.textContent = getProfileValue(profileData, 'Name') || 'Nitin Verma'; 
    document.getElementById('profileTitle')!.textContent = getProfileValue(profileData, 'Title') || 'Product Manager (Default)';
    (document.getElementById('profilePicture') as HTMLImageElement).src = getProfileValue(profileData, 'ProfileImageURL') || 'https://pzsvxfxmiuprmblkzhlu.supabase.co/storage/v1/object/public/portfolio//profile_no_bg.png';
    (document.getElementById('resumeLink') as HTMLAnchorElement).href = getProfileValue(profileData, 'ResumePDFURL') || 'https://pzsvxfxmiuprmblkzhlu.supabase.co/storage/v1/object/public/portfolio//Nitin%20Verma%20Resume.docx%20(3).pdf';
    document.getElementById('careerObjectiveText')!.textContent = getProfileValue(profileData, 'Objective') || 'Career objective could not be loaded. Please check Google Sheet "Profile" tab.';

    const contactInfoDiv = document.getElementById('contactInfo')!;
    contactInfoDiv.innerHTML = ''; // Clear existing

    const linkedInFromSheet = getProfileValue(profileData, 'LinkedInURL');
    let finalLinkedInUrl = '';
    if (linkedInFromSheet) {
        finalLinkedInUrl = linkedInFromSheet;
        if (!finalLinkedInUrl.startsWith('http://') && !finalLinkedInUrl.startsWith('https://') &&
            !finalLinkedInUrl.startsWith('mailto:') && !finalLinkedInUrl.startsWith('tel:')) {
            finalLinkedInUrl = `https://${finalLinkedInUrl}`;
        }
        contactInfoDiv.innerHTML += `<a href="${finalLinkedInUrl}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Profile" class="highlight-glow-on-hover"><i class="fab fa-linkedin"></i> LinkedIn</a>`;
        const footerLinkedInLink = document.getElementById('footerLinkedInLink') as HTMLAnchorElement;
        if (footerLinkedInLink) {
            footerLinkedInLink.href = finalLinkedInUrl;
            footerLinkedInLink.style.display = 'inline-block';
        }
    }


    const emailFromSheet = getProfileValue(profileData, 'Email');
    if (emailFromSheet) {
        const finalEmailUrl = `mailto:${emailFromSheet}`;
        contactInfoDiv.innerHTML += `<a href="${finalEmailUrl}" aria-label="Email" class="highlight-glow-on-hover"><i class="fas fa-envelope"></i> ${emailFromSheet}</a>`;
        const footerEmailLink = document.getElementById('footerEmailLink') as HTMLAnchorElement;
        if (footerEmailLink) {
            footerEmailLink.href = finalEmailUrl;
            footerEmailLink.style.display = 'inline-block';
        }
    }

    const phoneFromSheet = getProfileValue(profileData, 'Phone');
    if (phoneFromSheet) {
        contactInfoDiv.innerHTML += `<span class="highlight-glow-on-hover"><i class="fas fa-phone"></i> ${phoneFromSheet}</span>`;
    }

    const locationFromSheet = getProfileValue(profileData, 'Location');
    if (locationFromSheet) {
        contactInfoDiv.innerHTML += `<span class="highlight-glow-on-hover"><i class="fas fa-map-marker-alt"></i> ${locationFromSheet}</span>`;
    }
}

function renderSkills(coreSkills: string[][], technicalSkills: string[][]) {
    const renderSkillList = (elementId: string, skills: string[][]) => {
        const ul = document.querySelector(`#${elementId} ul`)!;
        ul.innerHTML = ''; // Clear loading/default
        if (skills.length > 0 && skills.some(row => row && row[0] && row[0].trim() !== '')) { // Added check for row
            skills.forEach(skillRow => {
                if (skillRow && skillRow[0] && skillRow[0].trim() !== '') { // Ensure skill name exists and is not just whitespace
                    const li = document.createElement('li');
                    li.textContent = skillRow[0].trim();
                    ul.appendChild(li);
                }
            });
        } else {
            ul.innerHTML = '<li>Skills data not available.</li>';
        }
    };

    renderSkillList('coreSkills', coreSkills);
    renderSkillList('technicalSkills', technicalSkills);
}

function renderExperience(experienceData: string[][]) {
    const timeline = document.getElementById('experienceTimeline')!;
    timeline.innerHTML = ''; // Clear loading/default

    if (experienceData.length === 0 || (experienceData.length === 1 && experienceData[0] && experienceData[0].every(cell => !cell || cell.trim() === ''))) {
        timeline.innerHTML = '<p>Work experience data not available or incomplete. Please check sheet "Experience".</p>';
        return;
    }

    experienceData.forEach((exp, index) => {
        if (!exp) return; // Skip if row is undefined (e.g. from sparse arrays after slice)
        const [date, title, company, descriptionString] = exp;
        if (!date && !title && !company && !(descriptionString && descriptionString.trim())) return; // Skip entirely empty logical rows

        const item = document.createElement('div');
        item.classList.add('timeline-item');
        
        // Find first non-empty item to make active (useful if initial data rows were sparse)
        const validItems = Array.from(timeline.children).filter(child => child.classList.contains('timeline-item'));
        if (validItems.length === 0 && (date || title || company)) { 
             item.classList.add('active');
        }


        const descriptionPoints = descriptionString ? descriptionString.split(';').map(s => s.trim()).filter(s => s) : [];

        item.innerHTML = `
            <div class="timeline-item-date">${date || 'Date N/A'}</div>
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <h3>${title || 'Title N/A'}</h3>
                <span class="company-name">${company || 'Company N/A'}</span>
                <div class="timeline-details">
                    <ul>
                        ${descriptionPoints.length > 0 ? descriptionPoints.map(point => `<li>${point}</li>`).join('') : '<li>Details not available.</li>'}
                    </ul>
                </div>
            </div>
        `;
        timeline.appendChild(item);

        const content = item.querySelector('.timeline-content');
        if (content) {
            content.addEventListener('click', () => {
                timeline.querySelectorAll('.timeline-item.active').forEach(activeItem => {
                    if (activeItem !== item) {
                        activeItem.classList.remove('active');
                    }
                });
                item.classList.toggle('active');
            });
        }
    });
     // If no item became active because all initial items were sparse, try to activate the first valid one added.
    if (!timeline.querySelector('.timeline-item.active')) {
        const firstValidItem = timeline.querySelector('.timeline-item');
        if (firstValidItem) firstValidItem.classList.add('active');
    }
}

function renderProjects(projectData: string[][]) {
    const grid = document.getElementById('projectGrid')!;
    grid.innerHTML = ''; // Clear loading/default

    if (projectData.length === 0 || (projectData.length === 1 && projectData[0] && projectData[0].every(cell => !cell || cell.trim() === ''))) {
        grid.innerHTML = '<p>Project data not available or incomplete. Please check sheet "Projects".</p>';
        return;
    }

    projectData.forEach(proj => {
        if (!proj) return; // Skip if row is undefined
        const [name, description] = proj;
        if (!name && !(description && description.trim())) return; // Skip empty logical rows

        const card = document.createElement('div');
        card.classList.add('project-card', 'holographic-effect-card');
        card.innerHTML = `
            <h4>${name || 'Project Name N/A'}</h4>
            <p>${description || 'Description not available.'}</p>
        `;
        grid.appendChild(card);
    });
}

function renderEducation(educationData: string[][]) {
    const list = document.getElementById('educationList')!;
    list.innerHTML = ''; // Clear loading/default

    if (educationData.length === 0 || (educationData.length === 1 && educationData[0] && educationData[0].every(cell => !cell || cell.trim() === ''))) {
        list.innerHTML = '<p>Education data not available or incomplete. Please check sheet "Education".</p>';
        return;
    }

    educationData.forEach(edu => {
        if (!edu) return; // Skip if row is undefined
        const [degree, institution, year] = edu;
        if (!degree && !institution && !year) return; // Skip empty logical rows

        const entry = document.createElement('div');
        entry.classList.add('education-entry', 'holographic-effect-card');
        entry.innerHTML = `
            <h3>${degree || 'Degree N/A'}</h3>
            <p>${institution || 'Institution N/A'}</p>
            <p><em>${year || 'Year N/A'}</em></p>
        `;
        list.appendChild(entry);
    });
}

function renderAwards(awardsData: string[][]) {
    const ul = document.getElementById('awardsList')!;
    ul.innerHTML = ''; // Clear loading/default

     if (awardsData.length === 0 || (awardsData.length === 1 && awardsData[0] && awardsData[0].every(cell => !cell || cell.trim() === ''))) {
        ul.innerHTML = '<li>Awards data not available. Please check sheet "Awards".</li>';
        return;
    }

    awardsData.forEach(awardRow => {
        if (awardRow && awardRow[0] && awardRow[0].trim() !== '') { // Ensure award name exists and is not just whitespace
            const li = document.createElement('li');
            li.classList.add('holographic-effect-card');
            li.textContent = awardRow[0].trim();
            ul.appendChild(li);
        }
    });
}

function renderTestimonials(testimonialsData: string[][]) {
    const grid = document.getElementById('testimonialGrid')!;
    grid.innerHTML = ''; // Clear loading/default

    if (testimonialsData.length === 0 || (testimonialsData.length === 1 && testimonialsData[0] && testimonialsData[0].every(cell => !cell || cell.trim() === ''))) {
        grid.innerHTML = '<p>Testimonial data not available or incomplete. Please check sheet "Testimonials".</p>';
        return;
    }

    testimonialsData.forEach(test => {
        if (!test) return; // Skip if row is undefined
        const [quote, author] = test;
        if (!(quote && quote.trim()) && !(author && author.trim())) return; // Skip empty logical rows

        const card = document.createElement('div');
        card.classList.add('testimonial-card', 'holographic-effect-card');
        card.innerHTML = `
            <p>"${quote || 'Quote not available.'}"</p>
            <p class="testimonial-author">${author || 'Author N/A'}</p>
        `;
        grid.appendChild(card);
    });
}

// --- CVSYNC FEATURE ---
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove "data:mime/type;base64," prefix
        };
        reader.onerror = error => reject(error);
    });
}

async function handleTailorResume() {
    const tailorButton = document.getElementById('tailorResumeButton') as HTMLButtonElement;
    const loadingDiv = document.getElementById('cvSyncLoading')!;
    const errorDiv = document.getElementById('cvSyncError')!;
    const outputContainer = document.getElementById('cvSyncOutputContainer')!;
    const outputTextElement = document.getElementById('tailoredResumeOutputText')!;
    const jobDescriptionInput = document.getElementById('jobDescriptionInput') as HTMLTextAreaElement;

    if (!uploadedResumeFile || !jobDescriptionInput.value.trim()) {
        errorDiv.textContent = "Please upload a resume (PDF) and provide a job description.";
        errorDiv.style.display = 'block';
        outputContainer.style.display = 'none';
        return;
    }

    if (!ai) {
        errorDiv.textContent = "CVSync feature is currently unavailable. Gemini API client not initialized (API key might be missing or invalid).";
        errorDiv.style.display = 'block';
        outputContainer.style.display = 'none';
        console.error("Gemini AI client not initialized. Cannot proceed with CVSync.");
        return;
    }

    tailorButton.disabled = true;
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    outputContainer.style.display = 'none';
    outputTextElement.textContent = '';

    try {
        const base64PdfData = await fileToBase64(uploadedResumeFile);
        const jobDescriptionText = jobDescriptionInput.value.trim();

        const promptText = `You are an expert resume writer and career coach.
Analyze the content of the provided PDF resume and the following job description.
Your task is to revise the resume content to be highly tailored and optimized for the job description.

Job Description:
---
${jobDescriptionText}
---

Instructions for revision:
1.  Focus on highlighting the most relevant skills, experiences, and achievements from the resume that directly match the requirements and preferences stated in the job description.
2.  Integrate keywords and key phrases from the job description naturally into the resume content.
3.  Rephrase bullet points and summaries to showcase impact and alignment with the target role.
4.  Maintain a professional tone and ensure the language is clear, concise, and action-oriented.
5.  If the resume has a summary or objective, tailor it specifically to the job.
6.  The output should be *only* the revised resume content, ready to be copied and pasted. Do not include any introductory phrases (e.g., "Here's the revised resume:", "Based on your resume and JD..."), conversational filler, or concluding remarks. Just provide the pure, revised resume text, structured logically (e.g., Summary, Experience, Skills sections, as appropriate based on the input resume structure).
7.  If sections like "Projects" or "Education" are present in the resume, ensure they are also reviewed and presented effectively in relation to the job description if applicable.

Output only the tailored resume content.`;


        const contents = {
            parts: [
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: base64PdfData,
                    },
                },
                { text: promptText },
            ],
        };
        
        // Using 'gemini-2.5-flash' which supports multimodal input.
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
        });

        const tailoredText = response.text;
        outputTextElement.textContent = tailoredText;
        outputContainer.style.display = 'block';

    } catch (e) {
        console.error("Error during CVSync process:", e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        let displayError = `An error occurred: ${errorMessage}.`;

        if (errorMessage.includes("SAFETY")) {
             displayError = `The generated content was blocked due to safety settings. Please try modifying your job description or resume content.`;
        } else if (errorMessage.includes("400") || errorMessage.toLowerCase().includes("api key not valid")) {
            displayError = "Error: API Key is invalid or the request is malformed. Please check your Gemini API key configuration.";
        } else if (errorMessage.toLowerCase().includes("quota")) {
            displayError = "Error: API quota exceeded. Please check your Gemini API quota.";
        } else if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
            displayError = "Network error: Failed to connect to the API. Please check your internet connection.";
        } else if (uploadedResumeFile && uploadedResumeFile.type !== "application/pdf") {
            displayError = "Invalid file type. Please upload a PDF resume."; // Should be caught earlier, but good fallback.
        } else if (errorMessage.includes("inline data") || errorMessage.includes("parse")) {
            displayError = "Error processing the PDF. Please ensure it's a valid PDF file and try again. The model may also have limitations with certain PDF structures."
        }
        
        errorDiv.textContent = displayError;
        errorDiv.style.display = 'block';
    } finally {
        tailorButton.disabled = false;
        loadingDiv.style.display = 'none';
        checkTailorButtonState(); // Re-evaluate button state
    }
}

function checkTailorButtonState() {
    const tailorButton = document.getElementById('tailorResumeButton') as HTMLButtonElement;
    const jobDescriptionInput = document.getElementById('jobDescriptionInput') as HTMLTextAreaElement;
    if (tailorButton) {
        const isJobDescriptionProvided = jobDescriptionInput && jobDescriptionInput.value.trim().length > 0;
        tailorButton.disabled = !(uploadedResumeFile && isJobDescriptionProvided);
    }
}

function initializeCVSync() {
    const resumeFileUpload = document.getElementById('resumeFileUpload') as HTMLInputElement;
    const fileNameDisplay = document.getElementById('fileNameDisplay')!;
    const jobDescriptionInput = document.getElementById('jobDescriptionInput') as HTMLTextAreaElement;
    const tailorResumeButton = document.getElementById('tailorResumeButton') as HTMLButtonElement;
    const copyResumeTextButton = document.getElementById('copyResumeTextButton') as HTMLButtonElement;
    const tailoredResumeOutputText = document.getElementById('tailoredResumeOutputText')!;
    const copyStatusMessage = document.getElementById('copyStatusMessage')!;
    const cvSyncErrorDiv = document.getElementById('cvSyncError')!; // Defined in HTML


    if (!process.env.API_KEY) {
        const cvSyncSection = document.getElementById('cvsync')!;
        if (cvSyncSection) {
             // Use existing error div
            cvSyncErrorDiv.textContent = "CVSync Feature Disabled: API_KEY for Gemini is not configured. Please set the API_KEY environment variable.";
            cvSyncErrorDiv.style.display = 'block';

            if (tailorResumeButton) tailorResumeButton.disabled = true;
            if (resumeFileUpload) resumeFileUpload.disabled = true;
            if (jobDescriptionInput) jobDescriptionInput.disabled = true;
            // Optionally hide the form or parts of it
            const form = cvSyncSection.querySelector('.cvsync-form');
            if (form) (form as HTMLElement).style.opacity = '0.5'; // Dim the form
        }
        return; // Stop further initialization of CVSync if API key is missing
    }


    if (resumeFileUpload && fileNameDisplay) {
        resumeFileUpload.addEventListener('change', (event) => {
            const files = (event.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                const file = files[0];
                if (file.type === "application/pdf") {
                    uploadedResumeFile = file;
                    fileNameDisplay.textContent = file.name;
                    cvSyncErrorDiv.style.display = 'none'; // Clear previous errors
                    cvSyncErrorDiv.textContent = '';
                } else {
                    uploadedResumeFile = null;
                    fileNameDisplay.textContent = "Invalid file type. Please upload a PDF.";
                    (event.target as HTMLInputElement).value = ''; // Clear the input
                    cvSyncErrorDiv.textContent = "Invalid file type. Please upload a PDF.";
                    cvSyncErrorDiv.style.display = 'block';
                }
            } else {
                uploadedResumeFile = null;
                fileNameDisplay.textContent = "No file selected";
            }
            checkTailorButtonState();
        });
    }

    if (jobDescriptionInput) {
        jobDescriptionInput.addEventListener('input', () => {
            if(jobDescriptionInput.value.trim().length > 0) {
                cvSyncErrorDiv.style.display = 'none'; // Clear error when user types in JD
                cvSyncErrorDiv.textContent = '';
            }
            checkTailorButtonState();
        });
    }

    if (tailorResumeButton) {
        tailorResumeButton.addEventListener('click', handleTailorResume);
    }

    if (copyResumeTextButton && tailoredResumeOutputText) {
        copyResumeTextButton.addEventListener('click', () => {
            navigator.clipboard.writeText(tailoredResumeOutputText.textContent || "")
                .then(() => {
                    copyStatusMessage.textContent = "Copied to clipboard!";
                    copyStatusMessage.style.color = 'var(--cred-accent)';
                    copyStatusMessage.style.display = 'inline';
                    setTimeout(() => {
                        copyStatusMessage.style.display = 'none';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                    copyStatusMessage.textContent = "Copy failed!";
                    copyStatusMessage.style.color = 'red'; // Error color
                    copyStatusMessage.style.display = 'inline';
                     setTimeout(() => {
                        copyStatusMessage.style.display = 'none';
                        copyStatusMessage.style.color = ''; // Reset color
                    }, 2000);
                });
        });
    }
     checkTailorButtonState(); // Initial check
}


// --- INTERACTIVITY ---
function initializeInteractivity() {
    // Back to Top Button
    const backToTopBtn = document.getElementById('backToTopBtn')!;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Active Nav Link Highlighting
    const navLinks = document.querySelectorAll('#navbar ul li a');
    const sections = document.querySelectorAll<HTMLElement>('section[id]');

    function updateActiveNavLink() {
        let currentSectionId = '';
        const navBarHeight = document.getElementById('navbar')?.offsetHeight || 70; // Use offsetHeight
        const scrollThreshold = window.innerHeight * 0.4; // Consider a section active if its top is within this portion from viewport top

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight; // Use offsetHeight
            const scrollPosition = window.scrollY + navBarHeight;

             // Check if the section is within the viewport, giving more preference to sections higher up.
            if (scrollPosition >= sectionTop - scrollThreshold && scrollPosition < sectionTop + sectionHeight - scrollThreshold) {
                 currentSectionId = section.id;
            }
        });
        
        // If scrolled to the very bottom, ensure the last link is active if its section is visible
        if ((window.innerHeight + Math.ceil(window.scrollY)) >= document.body.offsetHeight) {
            const lastVisibleSection = Array.from(sections).reverse().find(s => s.offsetParent !== null && s.id);
            if (lastVisibleSection) {
                currentSectionId = lastVisibleSection.id;
            }
        }


        navLinks.forEach(link => {
            link.classList.remove('active');
            const linkHref = link.getAttribute('href');
            if (linkHref && linkHref.substring(1) === currentSectionId) {
                link.classList.add('active');
            }
        });
    }
    window.addEventListener('scroll', updateActiveNavLink);
    window.addEventListener('resize', updateActiveNavLink);
    updateActiveNavLink(); // Initial check

    // Resume Button Click Particle Burst
    const resumeLink = document.getElementById('resumeLink') as HTMLAnchorElement;
    const resumeButton = resumeLink ? resumeLink.querySelector('button.glow-on-hover') : null;

    if (resumeLink && resumeButton) {
        resumeLink.addEventListener('click', (event) => {
            if (resumeLink.getAttribute('href') === '#') {
                event.preventDefault();
            }

            const rect = resumeButton.getBoundingClientRect();
            const buttonCenterX = rect.left + rect.width / 2;
            const buttonCenterY = rect.top + rect.height / 2;
            const numParticles = 30;

            for (let i = 0; i < numParticles; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle');
                document.body.appendChild(particle);

                const size = Math.random() * 7 + 3;
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.left = `${buttonCenterX - size / 2}px`;
                particle.style.top = `${buttonCenterY - size / 2}px`;

                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * 100 + 60;
                const translateX = Math.cos(angle) * distance;
                const translateY = Math.sin(angle) * distance;

                particle.style.setProperty('--tx', `${translateX}px`);
                particle.style.setProperty('--ty', `${translateY}px`);

                const duration = Math.random() * 0.6 + 0.4;
                particle.style.animationDuration = `${duration}s`;

                setTimeout(() => {
                    particle.remove();
                }, duration * 1000);
            }
        });
    }

    const magneticParticleField = document.getElementById('magneticParticleField');
    if (magneticParticleField) {
        const numMagneticParticles = 50;
        for (let i = 0; i < numMagneticParticles; i++) {
            const particle = document.createElement('div');
            particle.classList.add('magnetic-particle');

            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;

            const randomX = (Math.random() - 0.5) * 150;
            const randomY = (Math.random() - 0.5) * 150;
            particle.style.setProperty('--x', `${randomX}px`);
            particle.style.setProperty('--y', `${randomY}px`);

            const randomDuration = 1 + Math.random() * 1.5;
            const randomDelay = Math.random() * 1;
            particle.style.animation = `magneticParticleFloat ${randomDuration}s ${randomDelay}s ease-in-out infinite`;

            magneticParticleField.appendChild(particle);
        }
    }
    initializeCVSync(); // Initialize CVSync specific interactivity
}


// --- MAIN EXECUTION ---
document.addEventListener('DOMContentLoaded', async () => {
    const loadingIndicator = document.getElementById('loading-indicator')!;
    const mainContent = document.querySelector('main')!;
    loadingIndicator.style.display = 'block';

    try {
        const [
            profileData,
            coreSkillsData,
            technicalSkillsData,
            experienceData,
            projectData,
            educationData,
            awardsData,
            testimonialsData
        ] = await Promise.all([
            fetchSheetData(PROFILE_SHEET),
            fetchSheetData(SKILLS_CORE_SHEET),
            fetchSheetData(SKILLS_TECHNICAL_SHEET),
            fetchSheetData(EXPERIENCE_SHEET),
            fetchSheetData(PROJECTS_SHEET),
            fetchSheetData(EDUCATION_SHEET),
            fetchSheetData(AWARDS_SHEET),
            fetchSheetData(TESTIMONIALS_SHEET)
        ]);

        renderProfile(profileData);
        renderSkills(coreSkillsData, technicalSkillsData);
        renderExperience(experienceData);
        renderProjects(projectData);
        renderEducation(educationData);
        renderAwards(awardsData);
        renderTestimonials(testimonialsData);

        initializeInteractivity(); // This now also calls initializeCVSync()

    } catch (error) {
        console.error("Failed to load portfolio data:", error);
        mainContent.innerHTML = `
            <section class="section error-message" style="text-align: center; padding: 40px; background-color: var(--cred-surface-alt); border-radius: 15px; margin: 20px auto; max-width: 800px;">
                <h2><i class="fas fa-exclamation-triangle" style="color: #ffcc00;"></i> Oops! Something went wrong.</h2>
                <p style="font-size: 1.1em; color: var(--cred-text-secondary);">I couldn't load the portfolio data. This might be due to a temporary issue or a configuration problem.</p>
                <p style="margin-top: 20px;"><strong>Details:</strong> ${error instanceof Error ? error.message : String(error)}</p>
                <div style="margin-top: 30px; text-align: left; background-color: var(--cred-surface-inset-bg); padding: 20px; border-radius: 10px;">
                    <h4>Quick Checklist:</h4>
                    <ul style="list-style-type: disc; padding-left: 20px; font-size: 0.95em;">
                        <li>Ensure <code>GOOGLE_SHEETS_API_KEY</code> in <code>index.tsx</code> is correct and valid for Google Sheets.</li>
                        <li>Ensure <code>SPREADSHEET_ID</code> in <code>index.tsx</code> is correct.</li>
                        <li>The Google Sheet must be shared as "Anyone with the link can view".</li>
                        <li>Sheet tab names (e.g., "${PROFILE_SHEET}") in <code>index.tsx</code> must exactly match your Google Sheet.</li>
                        <li>The Google Sheets API must be enabled in your Google Cloud project.</li>
                        <li>The API key restrictions (if any) must allow your website domain and the Google Sheets API.</li>
                         <li>For CVSync: Ensure <code>process.env.API_KEY</code> is set with a valid <strong>Google Gemini API Key</strong>.</li>
                    </ul>
                    <p style="margin-top:15px;">For more detailed technical errors, please check the browser's developer console (usually F12).</p>
                </div>
            </section>
        `;
        document.querySelectorAll('main section:not(.error-message):not(#cvsync)').forEach(s => (s as HTMLElement).style.display = 'none');
        
        // Attempt to initialize CVSync even if sheet data fails, as it has its own API key and might be functional.
        // Also, if sheet data load fails, the profile-dependent parts of header/footer might not render.
        // We still want CVSync to be available if its API key is fine.
        if (document.getElementById('cvsync')) { // Check if the CVSync section exists
            initializeCVSync();
        }


        const header = document.querySelector('header');
        if (header) (header as HTMLElement).style.display = 'none';
        const footer = document.querySelector('footer');
        if (footer) (footer as HTMLElement).style.display = 'none';


    } finally {
        loadingIndicator.style.display = 'none';
    }
});