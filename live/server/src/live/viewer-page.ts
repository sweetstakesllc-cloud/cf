// Standalone viewer page. This is the exact mount contract the Shopify theme
// page reproduces: one div, the widget stylesheet, the widget script. Keeping
// the standalone page byte-compatible with the embed keeps it an honest
// integration test for the theme include.
export const VIEWER_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Circular Fash Live</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/live.css">
</head>
<body>
<div id="cf-live"></div>
<script src="/static/live.js" defer></script>
</body>
</html>
`;
