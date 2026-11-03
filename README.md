# Resume Generator

A web-based Resume Generator designed to help college students create professional resumes using their academic details, technical skills, projects, internships, and certifications.

The project aims to simplify resume creation by organizing student information into structured, customizable resume templates.

## Features

- **Student Information Management** — Organize personal details, education, skills, projects, and achievements.
- **Database Integration** — Retrieve and manage student information using a database.
- **Resume Templates** — Present student information in clean, professional layouts.
- **Resume Customization** — Edit resume details before generating the final document.
- **Certificate Management** — Include relevant certifications and achievements.
- **Resume Preview** — Review the resume layout before downloading or exporting it.

> Note: Update this list to reflect only the features currently implemented in the project.

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML | Page structure |
| CSS | Styling and layout |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime, if used |
| Express.js | Backend API, if used |
| MySQL / SQL | Student data storage |

## Project Structure

The project may be organized into the following structure. Adjust it to match the actual repository.

```text
Resume_Generator/
├── public/
│   ├── css/
│   ├── js/
│   └── assets/
├── views/
├── uploads/
├── routes/
├── server.js
├── package.json
├── .env.example
└── README.md
```

## Getting Started

### Prerequisites

Install the tools required by your project:

- [Node.js](https://nodejs.org/)
- npm (included with Node.js)
- MySQL, if the application uses a MySQL database
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Govindlaltl/Resume_Generator.git
   ```

2. Navigate to the project directory:

   ```bash
   cd Resume_Generator
   ```

3. Install dependencies, if `package.json` is present:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`, then set your MySQL credentials and `OPENROUTER_API_KEY`. Keep `.env` private; it is ignored by Git. The app uses OpenRouter's `openai/gpt-4o-mini` model by default, configurable with `OPENROUTER_MODEL`.

5. Start the application:

   ```bash
   npm start
   ```

   On startup, the server automatically creates the `resume_generator` database and its `students` and `certificates` tables. No manual SQL import is required.

6. Open the local URL displayed by the server in your browser.

## How to Use

1. Start the application and create an account with your name, email, username, and password, or log in.
2. Upload certificates and view your resume while signed in; the account identifies the student record.
3. Choose a resume template and print or save the resume as a PDF.

Passwords are stored as salted hashes in the `users` table, never as plain text. Login sessions are stored in `user_sessions` and expire after seven days.

## Future Improvements

- Additional professional resume templates.
- AI-assisted resume summaries and bullet-point suggestions.
- Applicant Tracking System (ATS) compatibility checks.
- Resume scoring and improvement recommendations.
- Authentication and individual student profiles.
- Export options for PDF and other formats.

## Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a new branch for your changes.
3. Implement and test your changes.
4. Submit a pull request with a description of your improvements.

## Author

**Govind Lal T L**

- GitHub: [@Govindlaltl](https://github.com/Govindlaltl)

## License

A license has not yet been specified. Add a `LICENSE` file and update this section if you decide to distribute the project under an open-source license.
