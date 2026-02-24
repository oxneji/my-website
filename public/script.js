
document.addEventListener('contextmenu', e => e.preventDefault());

const SOCIALS = {
  twitch: "https://twitch.tv/",
  spotify: "https://open.spotify.com/",
  youtube: "https://youtube.com/",
  github: "https://github.com/"
};

const enterScreen = document.getElementById("enter");
const mainCard = document.getElementById("main");

const audio = document.getElementById("bgAudio");
const btnPlay = document.getElementById("mpPlay");
const vol = document.getElementById("mpVolume");
const bar = document.getElementById("mpProgressBar");
const progress = document.querySelector(".mp-progress");

let playing = false;

function setPlayIcon() {
  if (!btnPlay) return;
  btnPlay.textContent = playing ? "⏸" : "▶";
}


if (enterScreen) {
  enterScreen.addEventListener("click", async () => {
    enterScreen.classList.add("hide");

    if (mainCard) {
      mainCard.classList.remove("hidden")
      setTimeout(() => {
        mainCard.classList.add("show");
      }, 150);
    }

    if (audio && !playing) {
      try {
        await audio.play();
        playing = true;
        setPlayIcon();
      } catch (e) {
        console.log("Audio play blocked:", e);
      }
    }
  });
}

const linkTwitch = document.getElementById("linkTwitch");
const linkSpotify = document.getElementById("linkSpotify");
const linkYouTube = document.getElementById("linkYouTube");
const linkGitHub = document.getElementById("linkGitHub");

if (linkTwitch) linkTwitch.href = SOCIALS.twitch;
if (linkSpotify) linkSpotify.href = SOCIALS.spotify;
if (linkYouTube) linkYouTube.href = SOCIALS.youtube;
if (linkGitHub) linkGitHub.href = SOCIALS.github;

async function loadViews() {
  try {
    const res = await fetch("/api/views");
    const data = await res.json();

    const el = document.getElementById("viewsCount");
    if (el) el.textContent = data.views;
  } catch (e) {
    console.error("Failed to load views");
  }
}

loadViews();

const bio = document.getElementById("bioText");
if (bio) {
  const textLength = bio.textContent.length;
  bio.style.setProperty("--chars", textLength);
  bio.classList.add("typing");
}

async function loadProfile() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    let userId = urlParams.get('user');

    // If no user ID in query, try to get slug from path
    if (!userId) {
      const path = window.location.pathname.split('/').filter(p => p !== '');
      if (path.length > 0) {
        const slug = path[0];
        // Fetch profile info using slug
        const profilesRes = await fetch('/api/profiles');
        const profiles = await profilesRes.json();
        const profile = profiles.find(p => p.slug === slug);
        if (profile) userId = profile.id;
      }
    }

    const apiPath = userId ? `/api/profile/${userId}` : "/api/profile";

    const res = await fetch(apiPath);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const nameEl = document.getElementById("discordName");
    const avatarEl = document.getElementById("discordAvatar");
    if (nameEl) nameEl.textContent = data.username || "neji";
    if (avatarEl && data.avatar) avatarEl.src = data.avatar;

    if (data.id) {
      try {
        const lanyardRes = await fetch(`https://api.lanyard.rest/v1/users/${data.id}`);
        const lanyardData = await lanyardRes.json();
        if (lanyardData.success) {
          const l = lanyardData.data;

          // Update Tab Title and Icon
          const username = l.discord_user.global_name || l.discord_user.username;
          const avatarHash = l.discord_user.avatar;
          const avatarUrl = `https://cdn.discordapp.com/avatars/${l.discord_user.id}/${avatarHash}.png?size=128`;

          document.title = `${username} (@${l.discord_user.username})`;
          let favicon = document.querySelector("link[rel*='icon']");
          if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
          }
          favicon.href = avatarUrl;


          const status = l.discord_status || 'offline';
          const statusDot = document.getElementById("statusDot");
          if (statusDot) {
            statusDot.className = `status-dot status-${status}`;
          }

          const statusContainer = document.getElementById("lanyardStatus");
          if (statusContainer) {
            let html = "";
            const activities = l.activities || [];
            const spotify = l.listening_to_spotify && l.spotify;
            const game = activities.find(a => a.type === 0);
            const customStatus = activities.find(a => a.type === 4);

            if (spotify) {
              const start = l.spotify.timestamps?.start || 0;
              const end = l.spotify.timestamps?.end || 0;
              let progress = 0;
              if (end > start) {
                progress = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
              }

              html = `
                    <div class="status-title">Listening to Spotify</div>
                    <div class="status-text">${l.spotify.song || 'Unknown Track'}</div>
                    <div class="status-sub">by ${l.spotify.artist || 'Unknown Artist'}</div>
                    <div class="spotify-progress"><div class="spotify-bar" style="width: ${progress}%"></div></div>
                `;
            } else if (game) {
              html = `
                    <div class="status-title">Playing ${game.name || 'a game'}</div>
                    <div class="status-text">${game.details || 'In-game'}</div>
                    ${game.state ? `<div class="status-sub">${game.state}</div>` : ''}
                `;
            } else if (customStatus) {
              html = `
                    <div class="status-title">Status</div>
                    <div class="status-text">${customStatus.state || ''}</div>
                `;
            }

            if (html) {
              statusContainer.innerHTML = html;
              statusContainer.style.display = "flex";
            } else {
              statusContainer.style.display = "none";
            }
          }
        }
      } catch (err) {
        console.error("Lanyard fetch failed for profile card:", err);
      }
    }

    const decoEl = document.getElementById("avatarDecoration");
    const bgContainer = document.getElementById("bg-container");
    if (data.background && bgContainer) {
      const bg = data.background.toLowerCase();
      const isVideo = bg.endsWith(".mp4") || bg.endsWith(".webm") || bg.includes("BackgroundMusic/vecteezy"); // Add specific check for user's Supabase URL if needed, but endsWith is safer for general use

      const currentAsset = bgContainer.dataset.asset;
      if (currentAsset !== data.background) {
        bgContainer.dataset.asset = data.background;
        if (isVideo) {
          bgContainer.innerHTML = `<video autoplay muted loop playsinline><source src="${data.background}" type="video/mp4"></video>`;
        } else {
          bgContainer.innerHTML = `<img src="${data.background}" alt="background">`;
        }
      }
    }
    const bioEl = document.getElementById("bioText");
    if (data.bio && bioEl && bioEl.textContent !== data.bio) {
      bioEl.textContent = data.bio;
      bioEl.style.setProperty("--chars", data.bio.length);

      // Force animation restart via class toggle
      bioEl.classList.remove("typing");
      void bioEl.offsetWidth; // trigger reflow
      bioEl.classList.add("typing");
    }
    if (data.decoration) {
      if (decoEl) {
        decoEl.src = data.decoration;
        decoEl.style.display = "block";
      }
    } else if (decoEl) {
      decoEl.style.display = "none";
    }

    if (data.socials) {
      const iconRow = document.querySelector(".icon-row");
      if (iconRow) {
        const validSocials = Object.entries(data.socials).filter(([_, link]) => link && link.trim() !== "");
        if (validSocials.length > 0) {
          iconRow.innerHTML = validSocials.map(([platform, link]) => `
                  <a class="icon glow" href="${link}"><img src="icons/${platform}.svg"></a>
              `).join('');
          iconRow.style.display = "flex";
        } else {
          iconRow.style.display = "none";
        }
      }
    }

    if (data.music && audio) {
      const currentSrc = audio.src;
      const targetSrc = data.music.startsWith("http") ? data.music : window.location.origin + "/" + data.music;

      if (currentSrc !== targetSrc && !currentSrc.endsWith(data.music)) {
        const wasPlaying = !audio.paused;
        audio.src = data.music;
        if (wasPlaying) {
          audio.play().catch(e => console.log("Auto-play prevented:", e));
        }

        if (data.musicMeta) {
          const titleEl = document.getElementById("mpTitle");
          const artistEl = document.getElementById("mpArtist");
          if (titleEl) titleEl.textContent = data.musicMeta.title;
          if (artistEl) artistEl.textContent = data.musicMeta.artist + " - ";
          if (data.musicMeta.cover) {
            setCover(data.musicMeta.cover);
          }
        }
      }
    }

    setTimeout(loadProfile, 5_000);
  } catch (e) {
    console.error("Load Profile failed:", e);
  }
}
loadProfile();

const cursorDot = document.getElementById('cursor-dot');
let mouseX = 0, mouseY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  if (cursorDot) {
    cursorDot.style.left = mouseX + 'px';
    cursorDot.style.top = mouseY + 'px';
  }

  createParticle(mouseX, mouseY);
});

function createParticle(x, y) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = Math.random() * 3 + 1;
  p.style.width = size + 'px';
  p.style.height = size + 'px';
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  document.body.appendChild(p);

  p.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 0.5 },
    { transform: `translate(${(Math.random() - 0.5) * 40}px, ${(Math.random() - 0.5) * 40}px) scale(0)`, opacity: 0 }
  ], {
    duration: 800 + Math.random() * 400,
    easing: 'cubic-bezier(0, .5, .5, 1)'
  }).onfinish = () => p.remove();
}

if (audio && vol) audio.volume = Number(vol.value);

if (btnPlay && audio) {
  btnPlay.addEventListener("click", async () => {
    try {
      if (!playing) {
        await audio.play();
        playing = true;
      } else {
        audio.pause();
        playing = false;
      }
      setPlayIcon();
    } catch (e) {
      console.log("Play blocked by browser until interaction.");
    }
  });
}

if (vol && audio) {
  vol.addEventListener("input", () => {
    audio.volume = Number(vol.value);
  });
}

if (audio && bar) {
  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    bar.style.width = pct + "%";
  });
}

if (progress && audio) {
  progress.addEventListener("click", (e) => {
    if (!audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });
}

setPlayIcon();

const mpCover = document.querySelector('.mp-cover');
function setCover(url) {
  if (mpCover) mpCover.style.backgroundImage = `url('${url}')`;
}

setCover('cover.jpeg');
