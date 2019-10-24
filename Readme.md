# ding-downloader

Download your Ring doorbell videos from The Cloud™. Written in an hour with zero error handling, but it does throttle itself per-request type and globally. This does exactly what I need it to do (make local backups on a cron job) but may take some modification to get it to do what YOU want it to do.

Note: If you want this to run on a cron job, you'll have to also write a script to refresh your session token regularly. I'll leave that as an exercise to the reader.

# What does this download?

The raw video files from Ring's server. That means a 1280 × 720 MP4 with no annoying Ring logo at the bottom right (at least on my Ring 2).

# Usage

1. Run `yarn install` or `npm install` to get dependencies
2. Get your session token by going to Ring.com, logging in, opening your dev tools, and copying the cookie value for \_session_id (it should be 32 chars)
3. Run `node app.js YOURSESSIONTOKENHERE` or put your session token on line 13 of `download.js`
4. Wait

### Why am I getting a SyntaxError: Unexpected identifier?

You probably ran `node download.js`- either run `node app.js` or `node -r esm download.js`
