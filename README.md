# Student Mentorship Platform

A React and Express application for connecting students with mentors. Students can browse mentors, submit requests, and track their status. Mentors can review and respond to requests.

## Requirements

- Node.js 20.19 or newer
- npm
- A MongoDB Atlas connection URI

## Configure the server

In PowerShell, from the project root:

```powershell
Copy-Item server/.env.example server/.env
```

Edit `server/.env` and set `MONGO_URI` to your Atlas connection string. Generate a private JWT secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `JWT_SECRET`. Keep `server/.env` private; it is ignored by Git.

Install and start the API:

```powershell
cd server
npm install
npm run dev
```

The API listens on port 5000 by default and connects to the `student_mentorship` database.

## Start the client

In a second terminal, from the project root:

```powershell
cd client
npm install
npm run dev
```

Open `http://127.0.0.1:8080`.

## Run server tests

From the project root:

```powershell
cd server
npm test
```

The current tests cover protected request routes, student ownership, mentor authorization, and profile protection.

## Current implementation notes

- Mentorship requests are stored in MongoDB when the database is connected. The local development fallback keeps requests in memory and loses them when the server restarts.
- Mentor profiles are currently seeded in the API route rather than managed as database records.
- The API permits local frontend origins on ports 5173 and 8080.