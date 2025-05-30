/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is the main script for your portfolio website.
 * It fetches your professional information from Google Sheets,
 * displays it on the webpage, and adds interactive features.
 */

// --- CONFIGURATION ---
// IMPORTANT: These values need to be updated with your actual Google Sheets details.

// Your unique Google Sheets API Key. This allows the website to read data from your sheet.
// How to get one: https://developers.google.com/sheets/api/guides/authorizing#APIKey
const GOOGLE_SHEETS_API_KEY: string = 'AIzaSyCgtYEXXzvUxYH9qtpaSFTmLkHdKTlHRmg'; // <--- UPDATE THIS!

// The ID of your Google Spreadsheet. You can find this in the URL of your spreadsheet.
// Example: If your sheet URL is https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit,
// then YOUR_SPREADSHEET_ID is what you need here.
const SPREADSHEET_ID: string = '10rm-DG6knR_1F6TIhMdEFSehRO26F_4Zuyb_uFCt4AA'; // <--- UPDATE THIS!

// These are the names of the tabs (sheets) in your Google Spreadsheet.
// Make sure these names EXACTLY match the tab names in your sheet.
const PROFILE_SHEET = 'Profile'; // For your basic info like name, title, contact.
const SKILLS_CORE_SHEET = 'SkillsCore'; // For your core or soft skills.
const SKILLS_TECHNICAL_SHEET = 'SkillsTechnical'; // For your technical skills.
const EXPERIENCE_SHEET = 'Experience'; // For your work history.
const PROJECTS_SHEET = 'Projects'; // For your projects.
const EDUCATION_SHEET = 'Education'; // For your educational background.
const AWARDS_SHEET = 'Awards'; // For any awards or recognitions.
const TESTIMONIALS_SHEET = 'Testimonials'; // For testimonials or recommendations.

// --- HELPER FUNCTIONS ---

/**
 * Fetches data from a specific tab (sheet) in your Google Spreadsheet.
 * @param sheetName The name of the sheet tab to fetch data from.
 * @returns A promise that resolves to a 2D array of strings (rows and columns from the sheet).
 */
async function fetchSheetData(sheetName: string): Promise<string[][]> {
    // Check if API Key and Spreadsheet ID have been updated from placeholders.
    if (SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID' || SPREADSHEET_ID === '') {
        const msg = `CRITICAL: The Spreadsheet ID ('${SPREADSHEET_ID}') is a placeholder or empty. Please update SPREADSHEET_ID in index.tsx with your actual value.`;
        console.error(msg);
        throw new Error(msg);
    }

    if (GOOGLE_SHEETS_API_KEY === 'YOUR_GOOGLE_SHEETS_API_KEY' || GOOGLE_SHEETS_API_KEY === '') {
        const msg = `CRITICAL: The Google Sheets API Key ('${GOOGLE_SHEETS_API_KEY}') is a placeholder or empty. This will not work. Please update GOOGLE_SHEETS_API_KEY in index.tsx with a *valid* Google Sheets API Key.`;
        console.error(msg);
        throw new Error(msg);
    } else if (GOOGLE_SHEETS_API_KEY.startsWith('GOCSPX-')) {
        const msg = `CRITICAL: The configured GOOGLE_SHEETS_API_KEY looks like a Client Secret, not an API Key. This will not work. Please use a valid Google Sheets API Key.`;
        console.error(msg);
        throw new Error(msg);
    }

    // Construct the URL to request data from the Google Sheets API.
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${GOOGLE_SHEETS_API_KEY}`;

    try {
        // Make the network request to fetch the data.
        const response = await fetch(url);
        // Check if the request was successful.
        if (!response.ok) {
            const responseBody = await response.text(); // Get more details from the error response.
            let detailedError = `Could not fetch data for sheet "${sheetName}". Status: ${response.status} ${response.statusText}. Response: ${responseBody}. `;
            // Provide more specific help based on common error codes.
            if (response.status === 403) {
                detailedError += "This often means the Google Sheets API is not enabled for your project, the API key is invalid/restricted, or the sheet is not public ('Anyone with the link can view').";
            } else if (response.status === 400) {
                 detailedError += "This often indicates an 'API key not valid' error or a problem with the request itself. Double-check your API Key.";
            } else if (response.status === 404) {
                 detailedError += `The spreadsheet (ID: "${SPREADSHEET_ID}") or the sheet tab named "${sheetName}" might not be found. Check the ID and sheet name.`;
            }
            console.error(`Error fetching sheet ${sheetName}: ${response.statusText}`, responseBody);
            throw new Error(detailedError); // Stop execution and show the error.
        }
        // If successful, parse the JSON data from the response.
        const data = await response.json();
        return data.values || []; // Return the rows of data, or an empty array if the sheet is empty.
    } catch (error) {
        console.error(`Exception during fetch or processing for sheet ${sheetName}:`, error);
        if (error instanceof Error && (error.message.startsWith("CRITICAL:") || error.message.includes("Could not fetch data"))) {
            throw error; // Re-throw specific errors we've already detailed.
        }
        // For other types of errors, create a new error message.
        throw new Error(`Failed to fetch or process data for sheet "${sheetName}". Original error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * A small helper to get a specific value from the 'Profile' sheet data.
 * It assumes the 'Profile' sheet has two columns: Key (e.g., "Name") and Value (e.g., "Nitin Verma").
 * @param profileData The 2D array of data from the 'Profile' sheet.
 * @param key The key (e.g., "Name", "Title") to look for in the first column.
 * @returns The corresponding value from the second column, or an empty string if not found.
 */
function getProfileValue(profileData: string[][], key: string): string {
    const row = profileData.find(r => r && r[0] === key); // Find the row where the first cell matches the key.
    return row && row[1] ? row[1].trim() : ''; // If found, return the trimmed value from the second cell.
}

// --- RENDERING FUNCTIONS ---
// These functions take data fetched from Google Sheets and update the HTML of the webpage.

/**
 * Displays your profile information (name, title, picture, contact details, objective) on the page.
 * @param profileData Data from the 'Profile' sheet.
 */
function renderProfile(profileData: string[][]) {
    // Update name in header, nav logo, and footer.
    document.getElementById('profileName')!.textContent = getProfileValue(profileData, 'Name') || 'Nitin Verma (Default)';
    document.getElementById('footerName')!.textContent = getProfileValue(profileData, 'Name') || 'Nitin Verma (Default)';
    document.querySelector('.nav-logo')!.textContent = getProfileValue(profileData, 'Name') || 'Nitin Verma (Default)';
    // Update title.
    document.getElementById('profileTitle')!.textContent = getProfileValue(profileData, 'Title') || 'Product Manager (Default)';
    // Update profile picture.
    (document.getElementById('profilePicture') as HTMLImageElement).src = getProfileValue(profileData, 'ProfileImageURL') || 'https://via.placeholder.com/160';
    // Update resume download link.
    (document.getElementById('resumeLink') as HTMLAnchorElement).href = getProfileValue(profileData, 'ResumePDFURL') || '#';
    // Update career objective text.
    document.getElementById('careerObjectiveText')!.textContent = getProfileValue(profileData, 'Objective') || 'Career objective could not be loaded. Please check Google Sheet "Profile" tab.';

    // Update contact information (LinkedIn, Email, Phone, Location).
    const contactInfoDiv = document.getElementById('contactInfo')!;
    contactInfoDiv.innerHTML = ''; // Clear any existing contact info.

    // LinkedIn
    const linkedInFromSheet = getProfileValue(profileData, 'LinkedInURL');
    if (linkedInFromSheet) {
        let finalLinkedInUrl = linkedInFromSheet.trim(); // Trim whitespace
        // Ensure the URL has a protocol (http:// or https://).
        if (!finalLinkedInUrl.startsWith('http://') && !finalLinkedInUrl.startsWith('https://') &&
            !finalLinkedInUrl.startsWith('mailto:') && !finalLinkedInUrl.startsWith('tel:')) {
            finalLinkedInUrl = `https://${finalLinkedInUrl}`;
        }
        contactInfoDiv.innerHTML += `<a href="${finalLinkedInUrl}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Profile" class="highlight-glow-on-hover"><i class="fab fa-linkedin"></i> LinkedIn</a>`;
        const footerLinkedInLink = document.getElementById('footerLinkedInLink') as HTMLAnchorElement;
        if (footerLinkedInLink) {
            footerLinkedInLink.href = finalLinkedInUrl;
            footerLinkedInLink.style.display = 'inline-block'; // Make it visible
        }
    }

    // Email
    const emailFromSheet = getProfileValue(profileData, 'Email');
    if (emailFromSheet) {
        const finalEmailUrl = `mailto:${emailFromSheet.trim()}`;
        contactInfoDiv.innerHTML += `<a href="${finalEmailUrl}" aria-label="Email" class="highlight-glow-on-hover"><i class="fas fa-envelope"></i> ${emailFromSheet.trim()}</a>`;
        const footerEmailLink = document.getElementById('footerEmailLink') as HTMLAnchorElement;
        if (footerEmailLink) {
            footerEmailLink.href = finalEmailUrl;
            footerEmailLink.style.display = 'inline-block'; // Make it visible
        }
    }

    // Phone
    const phoneFromSheet = getProfileValue(profileData, 'Phone');
    if (phoneFromSheet) {
        contactInfoDiv.innerHTML += `<span class="highlight-glow-on-hover"><i class="fas fa-phone"></i> ${phoneFromSheet.trim()}</span>`;
    }

    // Location
    const locationFromSheet = getProfileValue(profileData, 'Location');
    if (locationFromSheet) {
        contactInfoDiv.innerHTML += `<span class="highlight-glow-on-hover"><i class="fas fa-map-marker-alt"></i> ${locationFromSheet.trim()}</span>`;
    }
}

/**
 * Displays your core and technical skills on the page.
 * @param coreSkills Data from the 'SkillsCore' sheet.
 * @param technicalSkills Data from the 'SkillsTechnical' sheet.
 */
function renderSkills(coreSkills: string[][], technicalSkills: string[][]) {
    // Helper function to render a list of skills into a specific HTML <ul> element.
    const renderSkillList = (elementId: string, skills: string[][]) => {
        const ul = document.querySelector(`#${elementId} ul`)!; // Find the <ul> element.
        ul.innerHTML = ''; // Clear any "Loading..." text or previous skills.
        if (skills.length > 0 && skills[0] && skills[0].length > 0) {
            skills.forEach(skillRow => {
                if (skillRow && skillRow[0]) { // Ensure the skill name exists.
                    const li = document.createElement('li');
                    li.textContent = skillRow[0].trim(); // Add the skill name.
                    ul.appendChild(li);
                }
            });
        } else {
            ul.innerHTML = '<li>Skills data not available.</li>'; // Show if no skills found.
        }
    };

    renderSkillList('coreSkills', coreSkills);
    renderSkillList('technicalSkills', technicalSkills);
}

/**
 * Displays your work experience in a timeline format.
 * @param experienceData Data from the 'Experience' sheet.
 *          Each row should contain: Date, Title, Company, Description (semicolon-separated points).
 */
function renderExperience(experienceData: string[][]) {
    const timeline = document.getElementById('experienceTimeline')!;
    timeline.innerHTML = ''; // Clear "Loading..." text.

    if (experienceData.length === 0 || (experienceData[0] && experienceData[0].length < 4)) {
        timeline.innerHTML = '<p>Work experience data not available or incomplete. Please check sheet "Experience".</p>';
        return;
    }

    experienceData.forEach((exp, index) => {
        if (!exp || exp.length === 0) return; // Skip completely empty rows
        const [date, title, company, descriptionString] = exp;
        // Skip if all essential fields are missing for this entry
        if (!date && !title && !company && !descriptionString) return;

        const item = document.createElement('div');
        item.classList.add('timeline-item');
        // Make the first item in the timeline active (expanded) by default.
        if (index === 0) {
            item.classList.add('active');
        }

        // Split the description string into individual points (if separated by semicolons).
        const descriptionPoints = descriptionString ? descriptionString.split(';').map(s => s.trim()).filter(s => s) : [];

        // Create the HTML structure for each experience item.
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

        // Add interactivity: clicking an item toggles its 'active' state to show/hide details.
        const content = item.querySelector('.timeline-content');
        if (content) {
            content.addEventListener('click', () => {
                // Deactivate any other currently active item.
                timeline.querySelectorAll('.timeline-item.active').forEach(activeItem => {
                    if (activeItem !== item) {
                        activeItem.classList.remove('active');
                    }
                });
                // Toggle the 'active' class for the clicked item.
                item.classList.toggle('active');
            });
        }
    });
}

/**
 * Displays your projects in a grid format.
 * @param projectData Data from the 'Projects' sheet.
 *          Each row should contain: Project Name, Description.
 */
function renderProjects(projectData: string[][]) {
    const grid = document.getElementById('projectGrid')!;
    grid.innerHTML = ''; // Clear "Loading..." text.

    if (projectData.length === 0 || (projectData[0] && projectData[0].length < 2)) {
        grid.innerHTML = '<p>Project data not available or incomplete. Please check sheet "Projects".</p>';
        return;
    }

    projectData.forEach(proj => {
        if (!proj || proj.length === 0) return; // Skip empty rows
        const [name, description] = proj;
        if (!name && !description) return;

        const card = document.createElement('div');
        card.classList.add('project-card', 'holographic-effect-card'); // Add classes for styling.
        card.innerHTML = `
            <h4>${name || 'Project Name N/A'}</h4>
            <p>${description || 'Description not available.'}</p>
        `;
        grid.appendChild(card);
    });
}

/**
 * Displays your education details.
 * @param educationData Data from the 'Education' sheet.
 *          Each row should contain: Degree, Institution, Year.
 */
function renderEducation(educationData: string[][]) {
    const list = document.getElementById('educationList')!;
    list.innerHTML = ''; // Clear "Loading..." text.

    if (educationData.length === 0 || (educationData[0] && educationData[0].length < 3)) {
        list.innerHTML = '<p>Education data not available or incomplete. Please check sheet "Education".</p>';
        return;
    }

    educationData.forEach(edu => {
        if (!edu || edu.length === 0) return; // Skip empty rows
        const [degree, institution, year] = edu;
        if (!degree && !institution && !year) return;

        const entry = document.createElement('div');
        entry.classList.add('education-entry', 'holographic-effect-card'); // Add classes for styling.
        entry.innerHTML = `
            <h3>${degree || 'Degree N/A'}</h3>
            <p>${institution || 'Institution N/A'}</p>
            <p><em>${year || 'Year N/A'}</em></p>
        `;
        list.appendChild(entry);
    });
}

/**
 * Displays your awards and recognitions.
 * @param awardsData Data from the 'Awards' sheet.
 *          Each row should contain: Award Name.
 */
function renderAwards(awardsData: string[][]) {
    const ul = document.getElementById('awardsList')!;
    ul.innerHTML = ''; // Clear "Loading..." text.

    if (awardsData.length === 0 || (awardsData[0] && awardsData[0].length < 1)) {
        ul.innerHTML = '<li>Awards data not available. Please check sheet "Awards".</li>';
        return;
    }

    awardsData.forEach(awardRow => {
        if (awardRow && awardRow[0]) { // Ensure award name exists.
            const li = document.createElement('li');
            li.classList.add('holographic-effect-card'); // Add class for styling.
            li.textContent = awardRow[0].trim(); // Text content will be styled by CSS.
            ul.appendChild(li);
        }
    });
}

/**
 * Displays testimonials in a grid format.
 * @param testimonialsData Data from the 'Testimonials' sheet.
 *          Each row should contain: Quote, Author.
 */
function renderTestimonials(testimonialsData: string[][]) {
    const grid = document.getElementById('testimonialGrid')!;
    grid.innerHTML = ''; // Clear "Loading..." text.

    if (testimonialsData.length === 0 || (testimonialsData[0] && testimonialsData[0].length < 2)) {
        grid.innerHTML = '<p>Testimonial data not available or incomplete. Please check sheet "Testimonials".</p>';
        return;
    }

    testimonialsData.forEach(test => {
        if (!test || test.length === 0) return; // Skip empty rows
        const [quote, author] = test;
        if (!quote && !author) return;

        const card = document.createElement('div');
        card.classList.add('testimonial-card', 'holographic-effect-card'); // Add classes for styling.
        card.innerHTML = `
            <p>"${quote || 'Quote not available.'}"</p>
            <p class="testimonial-author">${author || 'Author N/A'}</p>
        `;
        grid.appendChild(card);
    });
}

/**
 * Initializes interactive features of the website after the main content has loaded.
 * This includes the "Back to Top" button, active navigation link highlighting,
 * and particle effects for the resume button.
 */
function initializeInteractivity() {
    // --- Back to Top Button ---
    // This feature shows a button that scrolls the page to the top when clicked.
    const backToTopBtn = document.getElementById('backToTopBtn')!;
    window.addEventListener('scroll', () => {
        // Show the button if the user has scrolled down more than 300 pixels.
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Smoothly scroll to the top.
    });

    // --- Active Navigation Link Highlighting ---
    // This feature highlights the current section in the navigation bar as the user scrolls.
    const navLinks = document.querySelectorAll('#navbar ul li a');
    const sections = document.querySelectorAll<HTMLElement>('section[id]'); // Get all sections with an ID.

    function updateActiveNavLink() {
        let currentSectionId = '';
        const navBarHeight = (document.getElementById('navbar') as HTMLElement)?.offsetHeight || 70; // Height of fixed navbar

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            // Determine if the section is currently in view, considering the navbar height.
            // The offset is slightly larger for the first section ("objective") for better UX.
            const viewOffset = section.id === 'objective' ? navBarHeight + 130 : navBarHeight + 30;
            if (window.scrollY >= sectionTop - viewOffset && window.scrollY < sectionTop + sectionHeight - viewOffset) {
                 currentSectionId = section.id;
            }
        });

        // Special case: if scrolled to the very bottom, highlight the last relevant section.
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) { // 100px buffer from bottom
            if (document.getElementById('testimonials')?.offsetParent !== null) currentSectionId = 'testimonials';
            else if (document.getElementById('awards')?.offsetParent !== null) currentSectionId = 'awards';
            // Add more fallbacks if needed for other potential last sections.
        }

        // Update the 'active' class on navigation links.
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    }
    window.addEventListener('scroll', updateActiveNavLink); // Update on scroll.
    updateActiveNavLink(); // Also update when the page first loads.

    // --- Resume Button Click Particle Burst ---
    // This creates a burst of particles when the "Download Resume" button is clicked.
    const resumeLink = document.getElementById('resumeLink') as HTMLAnchorElement;
    const resumeButton = resumeLink ? resumeLink.querySelector('button.glow-on-hover') : null;

    if (resumeLink && resumeButton) {
        resumeLink.addEventListener('click', (event) => {
            // Get the position of the resume button.
            const rect = resumeButton.getBoundingClientRect();
            const buttonCenterX = rect.left + rect.width / 2 + window.scrollX; // Add scrollX for correct position
            const buttonCenterY = rect.top + rect.height / 2 + window.scrollY; // Add scrollY for correct position
            const numParticles = 30; // Number of particles for the burst.

            for (let i = 0; i < numParticles; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle'); // Styled by CSS .particle and @keyframes particleBurst.
                document.body.appendChild(particle); // Add particle to the page.

                // Randomize particle size, position, and animation.
                const size = Math.random() * 7 + 3; // Particle size: 3px to 10px.
                particle.style.width = `${size}px`;
                particle.style.height = `${size}px`;
                particle.style.left = `${buttonCenterX - size / 2}px`; // Start at button center.
                particle.style.top = `${buttonCenterY - size / 2}px`;

                const angle = Math.random() * Math.PI * 2; // Random direction.
                const distance = Math.random() * 100 + 60; // How far particles travel.
                const translateX = Math.cos(angle) * distance;
                const translateY = Math.sin(angle) * distance;

                // Set custom CSS properties for the animation.
                particle.style.setProperty('--tx', `${translateX}px`);
                particle.style.setProperty('--ty', `${translateY}px`);

                const duration = Math.random() * 0.6 + 0.4; // Animation duration: 0.4s to 1s.
                particle.style.animationDuration = `${duration}s`;

                // Remove the particle from the page after its animation finishes.
                setTimeout(() => {
                    particle.remove();
                }, duration * 1000);
            }
        });
    }

    // --- Resume Button Hover Magnetic Particle Field ---
    // This creates a field of floating particles around the resume button on hover.
    const magneticParticleField = document.getElementById('magneticParticleField');
    if (magneticParticleField) {
        const numMagneticParticles = 50; // Number of floating particles.
        for (let i = 0; i < numMagneticParticles; i++) {
            const particle = document.createElement('div');
            particle.classList.add('magnetic-particle'); // Styled by CSS .magnetic-particle & @keyframes magneticParticleFloat.

            // Random initial position within the particle field.
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;

            // Random animation trajectory.
            const randomX = (Math.random() - 0.5) * 150; // Float range X: -75px to 75px.
            const randomY = (Math.random() - 0.5) * 150; // Float range Y.
            particle.style.setProperty('--x', `${randomX}px`);
            particle.style.setProperty('--y', `${randomY}px`);

            // Random animation duration and delay for a more organic look.
            const randomDuration = 1 + Math.random() * 1.5; // Duration between 1s and 2.5s.
            const randomDelay = Math.random() * 1; // Stagger start times slightly.
            particle.style.animation = `magneticParticleFloat ${randomDuration}s ${randomDelay}s ease-in-out infinite`;

            magneticParticleField.appendChild(particle);
        }
    }
}


// --- MAIN EXECUTION ---
// This code runs when the webpage (HTML structure) has finished loading.
document.addEventListener('DOMContentLoaded', async () => {
    const loadingIndicator = document.getElementById('loading-indicator')!;
    const mainContent = document.querySelector('main')!; // Used to display errors if data loading fails.
    loadingIndicator.style.display = 'block'; // Show the "Loading..." spinner.

    try {
        // Fetch all data from different Google Sheet tabs at the same time.
        // This is faster than fetching them one by one.
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

        // Once all data is fetched, update the webpage content.
        renderProfile(profileData);
        renderSkills(coreSkillsData, technicalSkillsData);
        renderExperience(experienceData);
        renderProjects(projectData);
        renderEducation(educationData);
        renderAwards(awardsData);
        renderTestimonials(testimonialsData);

        // Activate interactive features.
        initializeInteractivity();

    } catch (error) {
        // If any error occurs during data fetching or rendering:
        console.error("Failed to load portfolio data:", error);
        // Display a user-friendly error message on the page.
        mainContent.innerHTML = `
            <section class="section error-message" style="text-align: center; padding: 40px; background-color: var(--cred-surface-alt); border-radius: 15px; margin: 20px auto; max-width: 800px;">
                <h2><i class="fas fa-exclamation-triangle" style="color: #ffcc00;"></i> Oops! Something went wrong.</h2>
                <p style="font-size: 1.1em; color: var(--cred-text-secondary);">I couldn't load the portfolio data. This might be due to a temporary issue or a configuration problem.</p>
                <p style="margin-top: 20px;"><strong>Details:</strong> ${error instanceof Error ? error.message : String(error)}</p>
                <div style="margin-top: 30px; text-align: left; background-color: var(--cred-surface-inset-bg); padding: 20px; border-radius: 10px;">
                    <h4>Quick Checklist:</h4>
                    <ul style="list-style: disc; padding-left: 20px; font-size: 0.95em;">
                        <li>Ensure <code>GOOGLE_SHEETS_API_KEY</code> in <code>index.tsx</code> is correct and valid.</li>
                        <li>Ensure <code>SPREADSHEET_ID</code> in <code>index.tsx</code> is correct.</li>
                        <li>The Google Sheet must be shared as "Anyone with the link can view".</li>
                        <li>Sheet tab names (e.g., "${PROFILE_SHEET}", "${SKILLS_CORE_SHEET}", etc.) in <code>index.tsx</code> must exactly match your Google Sheet.</li>
                        <li>The Google Sheets API must be enabled in your Google Cloud project.</li>
                        <li>The API key restrictions (if any) must allow your website domain and the Google Sheets API.</li>
                    </ul>
                    <p style="margin-top:15px;">For more detailed technical errors, please check the browser's developer console (usually F12).</p>
                </div>
            </section>
        `;
        // Hide other sections that might still show "Loading..." text.
        document.querySelectorAll('main section:not(.error-message)').forEach(s => (s as HTMLElement).style.display = 'none');
        document.querySelector('header')!.style.display = 'none'; // Hide header.
        document.querySelector('footer')!.style.display = 'none'; // Hide footer.

    } finally {
        // This part always runs, whether there was an error or not.
        loadingIndicator.style.display = 'none'; // Hide the "Loading..." spinner.
    }
});
