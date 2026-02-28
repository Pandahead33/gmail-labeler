const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const dotenv = require('dotenv');
const open = require('open');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.modify'
];

let token = null;

app.get('/api/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });
  res.json({ url: authUrl });
});

app.get('/api/status', (req, res) => {
  console.log('Status check: token exists:', !!token);
  res.json({ authenticated: !!token });
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    token = tokens;
    // Redirect back to frontend
    res.redirect(`${process.env.FRONTEND_URL}?auth=success`);
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.redirect(`${process.env.FRONTEND_URL}?auth=failed`);
  }
});

app.get('/api/emails', async (req, res) => {
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const nextPageToken = req.query.pageToken;

  try {
    // Search for messages without Short, Medium, or Long labels
    // We'll search for emails that don't have these specific labels
    // First, we need to know the IDs of these labels. 
    // To keep it simple, we'll fetch messages and then filter them or just use a query if labels exist.
    // Query: "-label:Short -label:Medium -label:Long"

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      pageToken: nextPageToken,
      q: 'label:inbox category:updates -label:Short -label:Medium -label:Long -label:XL'
    });

    const messages = response.data.messages || [];
    const emailData = await Promise.all(messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id
      });

      const payload = detail.data.payload;
      const headers = payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value || '(No Subject)';

      let body = '';

      const getBodyData = (payload) => {
        let plainText = '';
        let htmlText = '';
        let allRaw = '';

        const traverse = (p) => {
          if (p.parts) {
            for (const part of p.parts) {
              traverse(part);
            }
          } else if (p.body && p.body.data) {
            const data = Buffer.from(p.body.data, 'base64').toString('utf-8');
            allRaw += data + '\n';
            if (p.mimeType === 'text/plain') {
              plainText += data;
            } else if (p.mimeType === 'text/html') {
              htmlText += data;
            }
          } else if (p.body && p.body.attachmentId) {
            // Skip attachments
          }
        };

        traverse(payload);

        let finalBody = '';
        if (plainText.trim()) {
          finalBody = plainText;
        } else {
          const cleanHtml = htmlText
            .replace(/<style([\s\S]*?)<\/style>/gi, '')
            .replace(/<script([\s\S]*?)<\/script>/gi, '');
          finalBody = cleanHtml.replace(/<[^>]*>?/gm, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
        }

        return { finalBody, allRaw };
      };

      const { finalBody, allRaw } = getBodyData(payload);
      body = finalBody;

      // Try to strip quoted text and specific signature blocks
      const originalLines = body.split('\n');
      const filteredLines = [];
      for (const line of originalLines) {
        const trimmed = line.trim();
        // Skip quoted lines but don't stop the whole process
        if (trimmed.startsWith('>')) continue;

        // Stop at common end-of-email markers
        if (trimmed.toLowerCase().startsWith('on ') && trimmed.includes(' wrote:')) {
          break;
        }
        // Only stop on --- if it's very likely a signature/footer divider (long)
        if (trimmed === '---' || trimmed === '--') {
          // Check if we already have some content. If so, this might be the end.
          if (filteredLines.length > 20) break;
          else continue;
        }

        filteredLines.push(line);
      }
      const cleanBody = filteredLines.join('\n').trim();
      const wordCount = cleanBody ? cleanBody.split(/\s+/).length : 0;

      // Robust Paywall Detection
      const isSubstack = allRaw.toLowerCase().includes('substack') || subject.toLowerCase().includes('substack');
      const paywallPhrases = [
        'Keep reading with a 7-day free trial',
        'Subscribe to keep reading',
        '∙ Preview',
        'Subscribe to keep reading this post'
      ];

      let paywallReason = '';
      const foundPhrase = paywallPhrases.find(phrase => allRaw.includes(phrase));
      if (foundPhrase) {
        paywallReason = `Found specific paywall phrase: "${foundPhrase}"`;
      }

      if (!paywallReason && isSubstack) {
        const trimmed = cleanBody.trim();
        if (trimmed.endsWith('...') || trimmed.endsWith('…')) {
          paywallReason = 'Substack content appears truncated (ends in ...)';
        }
      }

      const isPaywall = !!paywallReason;

      let suggestedLabel = 'Short';
      if (wordCount > 5000) {
        suggestedLabel = 'XL';
      } else if (wordCount > 1500) {
        suggestedLabel = 'Long';
      } else if (wordCount > 250) {
        suggestedLabel = 'Medium';
      } else {
        suggestedLabel = 'Short';
      }

      console.log(`SUBJECT: ${subject.substring(0, 50)}`);
      console.log(`WORD COUNT DETECTED: ${wordCount}`);
      console.log(`LABEL ASSIGNED: ${suggestedLabel}`);
      console.log(`IS PAYWALL: ${isPaywall} ${paywallReason ? `(${paywallReason})` : ''}`);
      console.log(`SNIPPET: ${cleanBody.substring(0, 100).replace(/\s+/g, ' ')}...`);
      console.log('-----------------------------------');

      return {
        id: msg.id,
        subject,
        wordCount,
        suggestedLabel,
        snippet: detail.data.snippet,
        body: cleanBody,
        isPaywall,
        paywallReason
      };
    }));

    res.json({
      emails: emailData,
      nextPageToken: response.data.nextPageToken
    });
  } catch (error) {
    console.error('Error fetching emails', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

app.post('/api/label', async (req, res) => {
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { labelsToApply } = req.body; // Array of { id: string, label: 'Short' | 'Medium' | 'Long' | 'XL' | 'skip' | 'archive' }
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    const labelsRes = await gmail.users.labels.list({ userId: 'me' });
    const labels = labelsRes.data.labels;
    const labelMap = {
      'Short': labels.find(l => l.name === 'Short')?.id,
      'Medium': labels.find(l => l.name === 'Medium')?.id,
      'Long': labels.find(l => l.name === 'Long')?.id,
      'XL': labels.find(l => l.name === 'XL')?.id,
    };

    await Promise.all(labelsToApply.map(async (item) => {
      console.log(`Processing email: ${item.id} with action: ${item.label}`);

      if (item.label === 'skip') {
        console.log(`Skipping email: ${item.id}`);
        return;
      }

      const requestBody = {};

      if (item.label === 'archive') {
        requestBody.removeLabelIds = ['INBOX'];
        console.log(`Archiving email: ${item.id}`);
      } else {
        const labelId = labelMap[item.label];
        if (labelId) {
          requestBody.addLabelIds = [labelId];
          console.log(`Labeling email ${item.id} as ${item.label} (${labelId}). Keeping in Inbox.`);
        } else {
          console.error(`Label ID not found for: ${item.label}`);
        }
      }

      await gmail.users.messages.modify({
        userId: 'me',
        id: item.id,
        requestBody
      });
    }));

    res.json({ success: true });
  } catch (error) {
    console.error('Error applying labels', error);
    res.status(500).json({ error: 'Failed to apply labels' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
