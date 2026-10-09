const app = document.getElementById('app');

app.innerHTML = `
<header class="site-header">
  <a class="brand" href="/">
    KASHIE
  </a>
  <nav class="nav">
    <a href="#artists">Artists</a>
    <a href="#artworks">Artworks</a>
    <a href="#opportunities">Opportunities</a>
  </nav>
  <div class="header-actions">
    <a class="secondary" href="#join">Join KASHIE</a>
  </div>
</header>

<section class="section hero">
  <div>
    <p class="eyebrow">FINE ART · ECOSYSTEM · DOCUMENTARY</p>
    <h1>The Time<br><em>Is Now.</em></h1>
    <p class="lead">
      Discover artists, explore original artworks,
      connect with collectors, and unlock opportunities
      through the KASHIE art ecosystem.
    </p>
    <div class="hero-actions">
      <a class="primary large" href="#artworks">Explore Artworks</a>
      <a class="secondary large" href="#join">Join Our Community</a>
    </div>
    <div class="trust-row">
      <span>Artist Discovery</span>
      <span>Original Art</span>
      <span>Creative Opportunities</span>
    </div>
  </div>

  <div class="hero-card">
    <div style="
      min-height:400px;
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-direction:column;
      color:#c8a36b;
      background:linear-gradient(135deg,#111416,#39332a,#111416);
      text-align:center;
      padding:25px;
    ">
      <div style="font-size:5rem;font-weight:900;letter-spacing:-8px">
        K.
      </div>
      <h2>KASHIE</h2>
      <p style="letter-spacing:4px">THE TIME IS NOW</p>
    </div>
  </div>
</section>

<section class="stats">
  <div><strong>01</strong><span>Discover Artists</span></div>
  <div><strong>02</strong><span>Explore Artworks</span></div>
  <div><strong>03</strong><span>Find Opportunities</span></div>
  <div><strong>04</strong><span>Connect & Create</span></div>
</section>

<section class="section" id="artists">
  <p class="eyebrow">THE CREATIVE COMMUNITY</p>
  <h2>Meet the Artists.</h2>
  <p class="lead">
    A platform for emerging and established creatives
    to showcase their talent and build connections.
  </p>
  <div class="grid3" id="artist-list">
    <article class="card">
      <div class="card-body">
        <h3>Discover Talent</h3>
        <p class="muted">Explore artists and their creative journeys.</p>
      </div>
    </article>
    <article class="card">
      <div class="card-body">
        <h3>Showcase Your Work</h3>
        <p class="muted">Build your presence in the art community.</p>
      </div>
    </article>
    <article class="card">
      <div class="card-body">
        <h3>Build Connections</h3>
        <p class="muted">Connect with collectors and opportunities.</p>
      </div>
    </article>
  </div>
</section>

<section class="section dark-section" id="artworks">
  <p class="eyebrow">CREATIVITY WITHOUT LIMITS</p>
  <h2>Art That Speaks.</h2>
  <p class="lead">
    Discover original artistic expression and explore
    the stories behind creative works.
  </p>
  <div class="grid3" id="artwork-list">
    <article class="card art-card">
      <div class="art-image"><span class="status">FINE ART</span></div>
      <div class="art-body">
        <h3>Original Expression</h3>
        <p>Explore creative ideas and artistic practice.</p>
      </div>
    </article>
    <article class="card art-card">
      <div class="art-image"><span class="status">DISCOVERY</span></div>
      <div class="art-body">
        <h3>Emerging Voices</h3>
        <p>Discover the next generation of artists.</p>
      </div>
    </article>
    <article class="card art-card">
      <div class="art-image"><span class="status">COLLECTIONS</span></div>
      <div class="art-body">
        <h3>Creative Collections</h3>
        <p>Celebrate art, culture, and imagination.</p>
      </div>
    </article>
  </div>
</section>

<section class="section" id="opportunities">
  <p class="eyebrow">GROW WITH KASHIE</p>
  <h2>More Than a Gallery.</h2>
  <div class="op-grid">
    <article class="op">
      <h3>Exhibitions</h3>
      <p>Discover opportunities to exhibit your work.</p>
    </article>
    <article class="op">
      <h3>Competitions</h3>
      <p>Participate in creative challenges.</p>
    </article>
    <article class="op">
      <h3>Commissions</h3>
      <p>Explore opportunities for commissioned art.</p>
    </article>
    <article class="op">
      <h3>Community</h3>
      <p>Connect with people who value creativity.</p>
    </article>
  </div>
</section>

<section class="section cta" id="join">
  <div>
    <p class="eyebrow">YOUR CREATIVE JOURNEY STARTS HERE</p>
    <h2>Become Part of KASHIE.</h2>
    <p>Join a growing ecosystem for art and creativity.</p>
  </div>
  <a class="primary large" href="mailto:hello@kashie.ng">
    Contact KASHIE
  </a>
</section>

<footer class="footer">
  <strong>KASHIE</strong>
  <p>The Time Is Now.</p>
  <p>Fine Art · Ecosystem · Documentary</p>
  <p>© ${new Date().getFullYear()} KASHIE. All rights reserved.</p>
</footer>
`;

fetch('/api/public/bootstrap')
  .then(response => {
    if (!response.ok) throw new Error('Could not load platform data');
    return response.json();
  })
  .then(data => {
    const artists = document.getElementById('artist-list');
    const artworks = document.getElementById('artwork-list');

    if (data.artists && data.artists.length) {
      artists.innerHTML = data.artists.map(artist => `
        <article class="card">
          <div class="card-body">
            <p class="eyebrow">KASHIE ARTIST</p>
            <h3>${escapeHTML(artist.name || 'Artist')}</h3>
            <p class="muted">${escapeHTML(artist.specialization || 'Creative Artist')}</p>
          </div>
        </article>
      `).join('');
    }

    if (data.artworks && data.artworks.length) {
      artworks.innerHTML = data.artworks.slice(0, 12).map(art => `
        <article class="card art-card">
          <div class="art-image"><span class="status">ARTWORK</span></div>
          <div class="art-body">
            <h3>${escapeHTML(art.title || 'Untitled Artwork')}</h3>
            <p>${escapeHTML(art.artist || 'KASHIE Artist')}</p>
          </div>
        </article>
      `).join('');
    }
  })
  .catch(error => {
    console.log('KASHIE is displaying its homepage:', error.message);
  });

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
    }
