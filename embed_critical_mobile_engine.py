# embed_critical_mobile_engine.py

# ==============================================================================
# 1. READ prototype.html AND INJECT DIRECT CRITICAL MOBILE STYLE INTO HEAD
# ==============================================================================

with open('prototype.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re

# Direct Head Style Block
critical_mobile_style = """
  <!-- CRITICAL ZERO-CACHE MOBILE ENGINE -->
  <style>
    /* Universal Mobile Constraints */
    *, *::before, *::after {
      box-sizing: border-box;
    }
    
    html, body {
      width: 100% !important;
      max-width: 100vw !important;
      overflow-x: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    @media (max-width: 768px) {
      /* FORCE HIDE CLUTTERED DESKTOP BARS ON MOBILE */
      .demo-control-bar,
      .ref-sidebar,
      .ref-top-header {
        display: none !important;
      }

      /* COMPACT 52PX SLIM MOBILE NAVBAR */
      .mobile-top-nav {
        display: flex !important;
        position: sticky !important;
        top: 0 !important;
        z-index: 1000 !important;
        height: 52px !important;
        padding: 0 16px !important;
        background: #072826 !important;
        align-items: center !important;
        justify-content: space-between !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }

      /* FLUID MOBILE WORKSPACE */
      .app-window-frame {
        width: 100% !important;
        max-width: 100vw !important;
        overflow-x: hidden !important;
        display: block !important;
      }

      .ref-main-workspace {
        width: 100% !important;
        max-width: 100vw !important;
        overflow-x: hidden !important;
        padding: 0 !important;
        margin: 0 !important;
      }

      .course-main-grid {
        display: block !important;
        width: 100% !important;
        max-width: 100vw !important;
        padding: 14px 14px 30px 14px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
      }

      .left-player-column {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 12px !important;
      }

      /* TITLE & BUTTONS ROW ON MOBILE */
      .course-title-header {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 10px !important;
        width: 100% !important;
        margin-bottom: 4px !important;
      }

      .course-main-h1 {
        font-size: 17px !important;
        line-height: 1.35 !important;
        margin: 0 !important;
        word-break: break-word !important;
      }

      .course-arabic-sub-tag {
        font-size: 18px !important;
        display: inline-block !important;
      }

      .course-meta-stats-row {
        font-size: 11px !important;
        gap: 5px !important;
        line-height: 1.4 !important;
        flex-wrap: wrap !important;
      }

      .header-cta-buttons {
        display: flex !important;
        width: 100% !important;
        gap: 8px !important;
        margin-top: 4px !important;
      }

      .btn-share-text {
        flex: 1 !important;
        border: 1px solid #E2ECEB !important;
        background: #F8FAFA !important;
        color: #08201E !important;
        padding: 8px 10px !important;
        font-size: 12px !important;
        justify-content: center !important;
        border-radius: 9999px !important;
      }

      .btn-enroll-primary {
        flex: 1.4 !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
        justify-content: center !important;
        border-radius: 9999px !important;
      }

      /* 16:9 VIDEO SCREEN WITHOUT CUTOFF */
      .ref-video-player-box {
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        aspect-ratio: 16 / 9 !important;
        max-height: 220px !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      .video-screen-content {
        width: 100% !important;
        height: 100% !important;
        padding: 10px !important;
        box-sizing: border-box !important;
      }

      .ref-video-watermark {
        font-size: 8px !important;
        padding: 2px 6px !important;
        top: 6px !important;
        left: 6px !important;
      }

      #currentVideoArabic {
        font-size: 17px !important;
        margin-bottom: 2px !important;
      }

      #currentVideoSubtitle {
        font-size: 10px !important;
        margin-bottom: 8px !important;
      }

      .center-glass-play {
        width: 44px !important;
        height: 44px !important;
        font-size: 18px !important;
      }

      /* SUB TABS SCROLL */
      .ref-sub-tabs-bar {
        display: flex !important;
        overflow-x: auto !important;
        white-space: nowrap !important;
        gap: 14px !important;
        padding-bottom: 6px !important;
        -webkit-overflow-scrolling: touch !important;
        scrollbar-width: none !important;
      }

      .ref-sub-tabs-bar::-webkit-scrollbar {
        display: none !important;
      }

      .sub-tab-btn {
        font-size: 12px !important;
        flex-shrink: 0 !important;
      }

      /* WORD CARDS */
      #subtab-audio > div > div:last-child {
        grid-template-columns: 1fr !important;
      }

      /* RIGHT ACCORDION COLUMN UNDERNEATH */
      .right-sidebar-column {
        width: 100% !important;
        margin-top: 14px !important;
        box-sizing: border-box !important;
      }
    }
  </style>
"""

# Replace stylesheet link with cache-busted link
html = html.replace('href="prototype.css"', 'href="prototype.css?v=2.6.0"')
html = html.replace('src="prototype.js"', 'src="prototype.js?v=2.6.0"')

# Inject critical style into head
if '<!-- CRITICAL ZERO-CACHE MOBILE ENGINE -->' not in html:
    html = html.replace('</head>', critical_mobile_style + '\n</head>')
else:
    # Update existing
    html = re.sub(r'<!-- CRITICAL ZERO-CACHE MOBILE ENGINE -->.*?</style>', critical_mobile_style.strip(), html, flags=re.DOTALL)

with open('prototype.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("SUCCESS: prototype.html injected with direct critical zero-cache mobile engine & cache-busted tags!")
