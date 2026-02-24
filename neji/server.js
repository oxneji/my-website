import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";

const VIEWS_FILE = "./views.json";

function readViews() {
  try {
    const data = fs.readFileSync(VIEWS_FILE, "utf8");
    return JSON.parse(data).views || 0;
  } catch {
    return 0;
  }
}

function writeViews(views) {
  fs.writeFileSync(VIEWS_FILE, JSON.stringify({ views }));
}


dotenv.config();

const app = express();
app.use(express.json());

// Serve card.html with dynamic Meta Tags based on slug or user param
app.get(["/card.html", "/:slug"], async (req, res, next) => {
  const slug = req.params.slug;
  const userId = req.query.user;

  // Skip if it is a file or API
  if (slug && (slug === "api" || slug.includes("."))) return next();
  if (!slug && !userId) return next();

  try {
    const data = fs.readFileSync("./profiles.json", "utf8");
    const configs = JSON.parse(data || "[]");

    // Find by slug or ID
    const config = configs.find(c => (slug && c.slug === slug) || (userId && c.id === userId));

    if (!config) return next();

    const cached = cachedProfiles.find(p => p.id === config.id);
    const title = cached?.username || config.username || "MNBLCK";
    const image = cached?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
    const bio = config.bio || "View my profile on MNBLCK";

    let html = fs.readFileSync("./public/card.html", "utf8");

    const metaTags = `
      <title>${title}</title>
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${bio}" />
      <meta property="og:image" content="${image}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${bio}" />
      <meta name="twitter:image" content="${image}" />
      <link rel="icon" type="image/png" href="${image}" />
    `;

    html = html.replace("<title>Neji?</title>", metaTags);
    res.send(html);
  } catch (err) {
    next();
  }
});

app.use(express.static("public"));

let cachedProfile = {
  username: "neji",
  avatar: null,
  updatedAt: null,
};

let cachedProfiles = [];

function avatarUrl(user) {
  if (!user.avatar) {
    const index = Number(BigInt(user.id) % 5n);
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
}

async function fetchDiscordUser(userId) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !userId) return null;

  try {
    const r = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!r.ok) return null;

    const user = await r.json();

    let decoration = null;
    if (user.avatar_decoration_data) {
      decoration = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=256`;
    }

    return {
      id: user.id,
      username: user.global_name || user.username,
      avatar: avatarUrl(user),
      decoration: decoration,
      updatedAt: Date.now(),
    };
  } catch (err) {
    console.error("Fetch failed for", userId, err);
    return null;
  }
}

async function updateAllProfiles() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const mainUserId = process.env.DISCORD_USER_ID;

  try {
    const data = fs.readFileSync("./profiles.json", "utf8");
    const memberConfigs = JSON.parse(data || "[]");

    const results = await Promise.all(memberConfigs.map(async config => {
      const discordData = await fetchDiscordUser(config.id);
      // Return config at minimum, merging with discordData if available
      return {
        id: config.id,
        username: config.username || discordData?.username || "Unknown User",
        avatar: config.avatar || discordData?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png",
        decoration: discordData?.decoration || null,
        ...discordData,
        ...config
      };
    }));

    cachedProfiles = results;
    if (mainUserId) {
      cachedProfile = cachedProfiles.find(p => p.id === mainUserId) || cachedProfiles[0];
    } else {
      cachedProfile = cachedProfiles[0];
    }

    console.log(`Updated ${cachedProfiles.length} profiles`);
  } catch (err) {
    console.error("Failed to read profiles.json or update profiles:", err);
  }
}

updateAllProfiles();
setInterval(updateAllProfiles, 5 * 60 * 1000);
app.get("/api/profile", (req, res) => {
  try {
    const data = fs.readFileSync("./profiles.json", "utf8");
    const configs = JSON.parse(data || "[]");
    const mainUserId = process.env.DISCORD_USER_ID;
    const config = configs.find(c => c.id === mainUserId) || configs[0];
    const cached = cachedProfiles.find(p => p.id === (config?.id || mainUserId));

    const merged = {
      username: "Unknown User",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
      ...cached,
      ...config
    };
    res.json(merged);
  } catch {
    res.json(cachedProfile);
  }
});

app.get("/api/profile/:id", (req, res) => {
  const userId = req.params.id;
  const cached = cachedProfiles.find(p => p.id === userId);

  try {
    const data = fs.readFileSync("./profiles.json", "utf8");
    const memberConfigs = JSON.parse(data || "[]");
    const config = memberConfigs.find(c => c.id === userId);

    if (config) {
      res.json({
        username: "Unknown User",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        ...cached,
        ...config
      });
    } else if (cached) {
      res.json(cached);
    } else {
      res.status(404).json({ error: "Profile not found" });
    }
  } catch (err) {
    if (cached) return res.json(cached);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/profiles", (req, res) => {
  try {
    const data = fs.readFileSync("./profiles.json", "utf8");
    const configs = JSON.parse(data || "[]");
    const merged = configs.map(c => {
      const cached = cachedProfiles.find(p => p.id === c.id);
      return {
        username: "Unknown User",
        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
        ...cached,
        ...c
      };
    });
    res.json(merged);
  } catch {
    res.json(cachedProfiles);
  }
});

app.get("/api/views", (req, res) => {
  let views = readViews();
  views += 1;
  writeViews(views);
  res.json({ views });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running http://localhost:${port}`);
});

