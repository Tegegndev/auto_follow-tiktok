# TikTok Auto-Follow and Unfollow Script

A simple browser script to automate following and unfollowing users on TikTok.

## Features

- **Auto-Follow**: Automatically finds and clicks "Follow" buttons on pages like "Suggested accounts", user "Following" lists, or user "Followers" lists.
- **Auto-Unfollow**: Automatically finds and clicks "Following" buttons and confirms the unfollow action.
- **Human-like Delays**: Uses randomized delays between actions to mimic human behavior and avoid detection.
- **Configurable**: Allows setting a maximum number of actions to perform in a session.
- **Removes Followed Users**: Hides user cards after following to prevent duplicates and keep the page clean.

## How to Use

1.  **Open TikTok in your browser** (e.g., Chrome, Firefox) and navigate to a page with a list of users (e.g., your "Following" list, someone's "Followers" list, or the "Suggested accounts" page).
2.  **Open the Developer Console**. You can usually do this by right-clicking on the page, selecting "Inspect", and then clicking on the "Console" tab. Or you can use the shortcut `Ctrl+Shift+J` (Windows/Linux) or `Cmd+Option+J` (Mac).
3.  **Copy the entire content** of the `app.js` file.
4.  **Paste the script** into the developer console and press `Enter`.
5.  **Instantiate and start the desired bot**.

### To Auto-Follow Users:

```javascript
// Create a new follower instance with your desired options
const af = new AutoFollower({
  maxFollows: 150, // Stop after 150 follows
  debug: true       // Show detailed logs in the console
});

// Start the bot
af.start();
```

### To Auto-Unfollow Users:

```javascript
// Create a new unfollower instance
const au = new AutoUnfollower({
  maxFollows: 100, // Stop after 100 unfollows
  debug: true
});

// Start the bot
au.start();
```

### To Stop the Bot Manually

You can stop the bot at any time by typing the following into the console and pressing `Enter`:

```javascript
// To stop the follower bot
af.stop();

// To stop the unfollower bot
au.stop();
```

## Disclaimer

This script is for educational purposes only. Automating actions on social media platforms may be against their Terms of Service. Use this script at your own risk. The developers of this script are not responsible for any consequences, such as account suspension or banning.