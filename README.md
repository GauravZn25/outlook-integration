# Outlook Mailbox Viewer (MERN)

A web page that shows every email in one Outlook.com mailbox (for example `address@outlook.com`), including its attached documents, in a clean Outlook-style layout.

**How access works:**

1. **You** run one command. It prints a link and a short code.
2. You send that link and code to the **mailbox owner**, who opens it on any device (a phone is fine), types the code, signs in and clicks **Accept**. This takes about 2 minutes, and they do it **once**.
3. The app receives a long-lived access token and **saves it in MongoDB**. From then on, you open the web page and see the mail. Nobody has to sign in again.

The owner **never shares their password**. The access is **read-only**: the app cannot send, delete or change anything, and opening an email here doesn't mark it as read. The owner can remove the access at any time.

> **Why not just copy and paste a token?** Microsoft access tokens expire after about 1 hour. The link-and-code method gives the app a *renewable* token that keeps itself fresh. You never handle the raw token.

```
 Mailbox owner                      You                                  Microsoft
 ─────────────                      ───                                  ─────────
                                    npm run connect ───────────────────▶ "here is code ABCD1234"
 opens link, types code,  ◀──────── send them the link + code
 signs in, clicks Accept  ─────────────────────────────────────────────▶ approved ✓
                                    token saved in MongoDB ◀───────────────────┘

 Later: React page (:5173) → Express (:4000) → token from MongoDB → Microsoft Graph → emails + attachments
```

---

## The steps at a glance

| # | Step | Who | Time |
|---|---|---|---|
| 1 | Install Node.js and MongoDB | You | 10 min |
| 2 | Register the app in the Azure portal → copy **1 value** (Client ID) | You | 5 min |
| 3 | Paste the value into `server/.env` | You | 1 min |
| 4 | Install the packages | You | 2 min |
| 5 | Get access from the mailbox owner (link + code) | You + owner | 2 min, **once** |
| 6 | Start the app and open the page | You | 1 min |

---

## Step 1 — Install the tools (one time)

### 1.1 Node.js

1. Go to **https://nodejs.org** and click the big **LTS** download button (the macOS installer, `.pkg`).
2. Open the downloaded file. Click **Continue** → **Continue** → **Agree** → **Install**. Enter your Mac password, then click **Close**.
3. Open **Terminal** (press `⌘ + Space`, type `Terminal`, press Enter). Run `node -v`. It must print **v20.19** or higher.

### 1.2 MongoDB. Pick **A** or **B**.

**A — On your Mac (needs Homebrew)**. Run these one at a time in Terminal:

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

Your connection string is `mongodb://127.0.0.1:27017/outlook-mail`. That's already the default, so there's nothing to change.

**B — MongoDB Atlas (free, in the cloud)**

1. Sign up at **https://www.mongodb.com/cloud/atlas/register**.
2. Choose the **Free** cluster (M0) → **Create Deployment**.
3. In the **Connect** dialog, create a database user with a username and a password. Use letters and numbers only in the password. Click **Create Database User**.
4. Click **Choose a connection method** → **Drivers**, and copy the string. It looks like:
   `mongodb+srv://myuser:<db_password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
5. Replace `<db_password>` with your password. Then add `outlook-mail` right after `.mongodb.net/`:
   `...cluster0.abcde.mongodb.net/outlook-mail?retryWrites=true&w=majority&appName=Cluster0`
6. In the left menu, go to **Network Access** → **+ Add IP Address** → **Add Current IP Address** → **Confirm**.

---

## Step 2 — Register the app with Microsoft (Azure portal)

You only do this once. The account you use here can be **your own** Microsoft account. It does not need to be the mailbox owner's.

### 2.1 Open App registrations

1. Go to **https://portal.azure.com** and sign in.
2. In the search bar at the top, type **App registrations** and click it under *Services*.

> Seeing *"The ability to create applications outside of a directory has been deprecated"*? See [Troubleshooting](#troubleshooting).

### 2.2 Create the registration

1. Click **+ New registration**.
2. **Name:** `Mailbox Viewer`
   *The mailbox owner will see this name on the approval screen, so pick something they'll recognize.*
3. **Supported account types:** select **"Accounts in any organizational directory (Any Microsoft Entra ID tenant – Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)"**.
   *The wording can vary slightly. Pick the option that mentions **personal Microsoft accounts**.*
4. **Redirect URI:** leave it **empty**.
5. Click **Register**.

### 2.3 Copy the Client ID

On the **Overview** page, click the copy icon next to **Application (client) ID** (it looks like `1a2b3c4d-…`). Save it. This is your **`AZURE_CLIENT_ID`** and the only value you need from Azure.

### 2.4 Allow the link-and-code sign-in

1. In the left menu, click **Authentication**.
2. Find **Allow public client flows**. It's at the bottom under *Advanced settings*, or on the **Settings** tab in the newer layout.
3. Set it to **Yes** (or **Enabled**), then click **Save**.

### 2.5 Add the mail permission

1. In the left menu, click **API permissions**. You'll see *Microsoft Graph → User.Read* already listed.
2. Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
3. Search for `Mail.Read`. Expand **Mail** and tick **Mail.Read**.
4. Search for `offline_access`. Expand **OpenId permissions** and tick **offline_access**.
5. Click **Add permissions**. The list now shows **Mail.Read**, **offline_access** and **User.Read**.
   *Skip "Grant admin consent". The mailbox owner gives consent themselves in Step 5.*

✅ You don't need a client secret or a redirect URI.

---

## Step 3 — Put the value into the code

1. Open the `outlook-integration` folder in VS Code (**File → Open Folder…**).
2. Open a terminal (**Terminal → New Terminal**) and run:

   ```bash
   cp server/.env.example server/.env
   ```

3. Open **`server/.env`** and fill in:

   | Line | Value |
   |---|---|
   | `AZURE_CLIENT_ID=` | The Application (client) ID from step 2.3 |
   | `MAILBOX_ADDRESS=` | The mailbox to read, e.g. `address@outlook.com`. The connection is refused if the owner signs in with a different account. |
   | `MONGODB_URI=` | Leave as is for MongoDB option A. For Atlas, paste your string. |

4. Save the file (`⌘ + S`). It's listed in `.gitignore`, so it never gets committed.

---

## Step 4 — Install the packages

In the VS Code terminal, from the `outlook-integration` folder:

```bash
cd server
npm install
cd ../client
npm install
cd ..
```

> npm may warn that *esbuild has install scripts not yet covered by allowScripts*. You can ignore it.

---

## Step 5 — Get access from the mailbox owner (one time)

### What you do

1. In the terminal:

   ```bash
   cd server
   npm run connect
   ```

2. It prints a ready-to-send message like this:

   ```
   ────────────────────────────────────────────────────────────────
    Hi! Please give me read-only access to your Outlook email:

      1. Open this link: https://www.microsoft.com/link
      2. Enter this code: 38L3GP39
      3. Sign in with address@outlook.com and click "Accept".

    The code works once and expires at 5:04 PM (in 15 minutes).
    You can remove the access any time at https://account.live.com/consent/Manage
   ────────────────────────────────────────────────────────────────
   Waiting for them to finish... (keep this window open)
   ```

3. Copy the part between the lines and send it to the mailbox owner by WhatsApp, SMS, email or any other way.
4. **Keep the terminal open** while they do their part. The code expires after **15 minutes**. If it runs out, just run `npm run connect` again.

### What the mailbox owner does

1. They open the link on any device and type the code. → **Next**
2. They sign in with **address@outlook.com** (password plus any 2-step code). If asked *"Are you trying to sign in to Mailbox Viewer?"*, they click **Continue**.
3. A screen says **"Let this app access your info?"** It lists *Read your mail*, *Maintain access to data you have given it access to* and *View your basic profile*. They click **Accept**.
   *It may say the app is "unverified". That's normal, because it's your private app.*
4. They see *"You have signed in to Mailbox Viewer…"* and can close the window.

### Done

Your terminal prints:

```
✓ Connected address@outlook.com. The token is saved in MongoDB.
```

You never need to repeat this unless access expires or is removed (see [How long access lasts](#how-long-access-lasts)).

---

## Step 6 — Start the app

You need **two terminals**. Click **+** in the VS Code terminal panel to open a second one.

**Terminal 1 — backend**

```bash
cd server
npm run dev
```

Expected output:

```
Connected to MongoDB
Mailbox connected: address@outlook.com
Server running on http://localhost:4000
```

**Terminal 2 — frontend**

```bash
cd client
npm run dev
```

Then open **http://localhost:5173** in your browser. 🎉

---

## Using the page

| Area | What it does |
|---|---|
| **Left: folders** | **All mail** (every folder at once), Inbox, Sent Items, Junk, your own folders… The number shows unread emails. |
| **Middle: email list** | Newest first: sender, subject, preview and date. **Bold with a blue bar** means unread. 📎 means it has attachments. **Load more** at the bottom shows older emails. |
| **"With attachments" tick box** | Shows only emails that have attached documents. |
| **Right: reading pane** | The full email, including pictures, with sender, To, Cc and date. **Open in Outlook** opens it on outlook.com. |
| **Attachment cards** | **Open** shows PDFs, images and text files in a new tab. **Download** saves any file (Word, Excel, ZIP…). Attached emails download as `.eml`. OneDrive links show **Open in Outlook**. |
| **Refresh** (top right) | Reloads the folders and the email list so new mail appears. |

On a phone, the page shows one pane at a time. Tap an email to read it, then tap **Back to list**.

---

## How long access lasts

- The app renews its token automatically. While the backend is running, it also renews once a day, so the access keeps working indefinitely.
- Access stops if any of these happen:
  - the app is unused for about **90 days**
  - the owner **changes their password**
  - the owner **removes the access**

  The page will then say *"Access to the mailbox has expired or was revoked"*. Repeat **Step 5**.
- **The owner removes access:** go to **https://account.live.com/consent/Manage** → **Mailbox Viewer** → **Remove these permissions**.
- **You remove access:** run `npm run disconnect` in the `server` folder. This deletes the saved token.
- **Switch to a different mailbox:** change `MAILBOX_ADDRESS` in `server/.env`, then run `npm run connect` again.

> 🔐 The saved token works like a read-only key to the mailbox. It's stored in MongoDB (collection `tokencaches`). Keep your database private, and don't put this app on the public internet without adding a login of your own first. As it is, anyone who can open the page can read the mail.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| `Missing settings in server/.env: AZURE_CLIENT_ID` | You haven't created or filled in `server/.env` yet. Redo Step 3. |
| `Could not connect to MongoDB` | **Option A:** run `brew services start mongodb-community`. **Atlas:** check the password in the string, and that your IP is listed under *Network Access*. |
| Azure: *"The ability to create applications outside of a directory has been deprecated"* | Your Microsoft account has no Azure directory yet. Create a free Azure account at **https://azure.microsoft.com/free**. This creates a "Default Directory"; app registrations are free. Then redo Step 2. |
| `npm run connect` → **"Microsoft did not return a sign-in code"** | `AZURE_CLIENT_ID` is wrong, or the app doesn't allow personal Microsoft accounts. Check steps 2.2 and 2.3. |
| `npm run connect` → **`invalid_client`** | "Allow public client flows" is off. Turn it on (step 2.4), click **Save**, and run `npm run connect` again. |
| The owner sees *"…is not enabled for consumers"* or *"…does not exist in the Microsoft account directory"* | The app was registered as single-tenant. Easiest fix: create a new registration with the correct account type (step 2.2) and put its Client ID in `.env`. |
| `npm run connect` → **"They signed in as X, but MAILBOX_ADDRESS is Y"** | The owner used a different Microsoft account. Run `npm run connect` again and ask them to pick the right one. |
| `npm run connect` → **`expired_token`** | The 15 minutes ran out. Run `npm run connect` again. |
| `npm run connect` → **`authorization_declined`** | The owner clicked *Cancel* or *No*. Run it again if that was a mistake. |
| Page: **"Cannot reach the server"** | The backend isn't running. Start it (Step 6, Terminal 1). |
| Page: **"No mailbox connected yet"** | Do Step 5, then click **Refresh**. |
| Page: **"Access to the mailbox has expired or was revoked"** | Do Step 5 again. |
| Page: **"Microsoft Graph error 403"** | The Mail.Read permission is missing. Add it (step 2.5). Then the owner removes the old approval at https://account.live.com/consent/Manage, and you run `npm run connect` again. |
| Port 4000 or 5173 already in use | Stop the other program. Or change `PORT` in `server/.env` **and** the URL in `client/vite.config.js`. (Port 5000 is avoided on purpose, because macOS AirPlay uses it.) |

---

## Reference

### Project layout

```
outlook-integration/
├── README.md                    ← this guide
├── server/                      ← Express + MongoDB + Microsoft Graph
│   ├── .env.example             ← copy to .env and fill in
│   ├── scripts/mailbox.js       ← npm run connect / npm run disconnect
│   └── src/
│       ├── index.js             ← starts the API server
│       ├── config.js            ← reads and checks .env
│       ├── db.js                ← MongoDB connection
│       ├── models/TokenCache.js ← the saved token (one document)
│       ├── services/msal.js     ← Microsoft sign-in library; renews the token
│       ├── services/graph.js    ← folders, emails, attachments from Microsoft Graph
│       └── routes/api.js        ← the /api endpoints below
└── client/                      ← React (Vite)
    ├── vite.config.js           ← forwards /api to the backend
    └── src/
        ├── App.jsx              ← page layout, Refresh, data loading
        ├── api.js               ← calls to the backend
        └── components/          ← FolderList, MessageList, MessageView,
                                   AttachmentList, EmailBody, Avatar, Icons
```

### API

| Method | Path | Returns |
|---|---|---|
| GET | `/api/status` | `{ connected, mailbox }` |
| GET | `/api/folders` | `{ folders: [{ id, name, total, unread }], inboxId }` |
| GET | `/api/messages?folder=<id or all>&skip=0&attachmentsOnly=1` | `{ messages: [...], hasMore }` (30 per page) |
| GET | `/api/messages/:id` | Full email: `{ subject, from, to, cc, body, attachments: [...] }` |
| GET | `/api/messages/:id/attachments/:attachmentId` | The file itself. Shown in the browser when safe (PDF, images, text). Add `?download=1` to always download. |

All `/api` routes except `/api/status` return `401 { needsConnect: true }` when no valid token is saved.
