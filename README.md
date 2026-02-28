# Gmail Labeler

A tool to automatically label emails in Gmail based on their content.

## How it Works

1. **Authentication**: Uses Google OAuth to securely access your Gmail account
2. **Email Analysis**: Scans incoming emails and analyzes their content
3. **Label Application**: Automatically applies appropriate labels based on predefined rules
4. **Server-Client Architecture**: Node.js backend handles Gmail API, React frontend provides UI

## Prerequisites

- Node.js (v16 or higher)
- Gmail account with API access enabled
- Google Cloud project with Gmail API enabled

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Pandahead33/gmail-labeler.git
cd gmail-labeler
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Google API Credentials

1. Create a Google Cloud project
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Download `credentials.json` and place it in the `server/` directory
5. Create `.env` file in `server/` with your credentials:

```
PORT=3001
REDIRECT_URI=http://localhost:3001/oauth2callback
CLIENT_ID=your-client-id.apps.googleusercontent.com
CLIENT_SECRET=your-client-secret
FRONTEND_URL=http://localhost:5173
```

### 4. Run the Application

#### Start the Server

```bash
cd server
npm start
```

#### Start the Client

```bash
cd ../client
npm run dev
```

The client will be available at http://localhost:5173 and the server at http://localhost:3001.

## Usage

1. Open the client in your browser
2. Click "Connect Gmail" to authenticate
3. Once connected, the labeler will automatically scan and label incoming emails
4. Configure label rules in the settings panel

## Features

- Automatic email labeling based on content analysis
- Real-time label application
- Gmail API integration
- Secure OAuth authentication
- Responsive React frontend

## Security

- OAuth tokens are stored securely
- No email content is stored on the server
- All Gmail API calls are authenticated

## License

This project is licensed under the MIT License.