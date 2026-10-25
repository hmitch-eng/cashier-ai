const palettes = {
  dates: { bg: '#E7E2CF', ink: '#354732', accent: '#C3862D', detail: '#F5EEDD' },
  coffee: { bg: '#EADBC6', ink: '#49352A', accent: '#C47A3B', detail: '#F7EBD8' },
  oil: { bg: '#DDE5D5', ink: '#2E4B36', accent: '#8D9A4D', detail: '#F3F1DA' },
  milk: { bg: '#DDE8E6', ink: '#2F5056', accent: '#78AAB0', detail: '#F9F5E9' },
  bread: { bg: '#F0E1CE', ink: '#6C472C', accent: '#D5A15E', detail: '#F9F0DF' },
  water: { bg: '#D9E7E8', ink: '#2E5660', accent: '#81B6BD', detail: '#F3FAF7' },
  yogurt: { bg: '#EDE2DC', ink: '#5B483F', accent: '#C88F7D', detail: '#FBF6EE' },
  tea: { bg: '#E5E2D2', ink: '#32452F', accent: '#A89A59', detail: '#F3EFE1' },
  tahini: { bg: '#EBE0C9', ink: '#5E482D', accent: '#C7A466', detail: '#F7EFDC' },
  juice: { bg: '#EAD9D4', ink: '#733229', accent: '#C5523F', detail: '#F9EDE7' },
  eggs: { bg: '#F0E6CF', ink: '#675436', accent: '#C9AB68', detail: '#F9F3E4' },
  honey: { bg: '#F0E0B9', ink: '#6C4A22', accent: '#E2A83A', detail: '#FAF2DB' },
  cheese: { bg: '#EFE4C2', ink: '#6B5830', accent: '#E0BC56', detail: '#FCF8EA' },
  cookie: { bg: '#E7D8C4', ink: '#614432', accent: '#C39767', detail: '#F5EAD7' },
  detergent: { bg: '#DCE5E5', ink: '#305460', accent: '#6E9EA6', detail: '#F5FAF7' },
  pantry: { bg: '#E6E2D6', ink: '#3B463B', accent: '#B49052', detail: '#F7F2E5' }
};

function barcodeMark(x, y, ink, width = 26, height = 9) {
  const bars = [1, 2, 1, 3, 1, 2, 3, 1, 1, 2, 1];
  let current = x;
  let output = '';
  bars.forEach((bar, index) => {
    output += `<rect x="${current}" y="${y}" width="${bar}" height="${index % 3 === 0 ? height : height - 2}" rx=".3"/>`;
    current += bar + 1.5;
    if (current > x + width) return;
  });
  return `<g fill="${ink}" opacity=".55">${output}</g>`;
}

const drawings = {
  dates: ({ ink, accent, detail }) => `
    <path d="M166 67c-12-14-27-25-44-28 7-7 18-10 29-8 15 3 25 14 28 28-4 4-8 6-13 8Z" fill="${accent}" stroke="${ink}" stroke-width="2.2"/>
    <path d="M134 72c-4-17 2-33 15-43M126 77c-8-11-8-27-2-40" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M80 92h80v34c0 7-5 12-12 12H92c-7 0-12-5-12-12V92Z" fill="${accent}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M80 92h80v15H80z" fill="${detail}" opacity=".85" stroke="${ink}" stroke-width="2.2"/>
    <path d="M89 107h62" stroke="${ink}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".65"/>
    <ellipse cx="103" cy="119" rx="10" ry="8" fill="#63432D" stroke="${ink}" stroke-width="1.8"/>
    <ellipse cx="125" cy="122" rx="10" ry="8" fill="#785333" stroke="${ink}" stroke-width="1.8"/>
    <ellipse cx="146" cy="118" rx="9" ry="7" fill="#5C3D29" stroke="${ink}" stroke-width="1.8"/>
    <path d="M98 119c3-4 7-4 10 0M120 122c3-4 7-4 10 0" stroke="${detail}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>
    <rect x="90" y="73" width="60" height="13" rx="2.5" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    ${barcodeMark(98, 77, ink, 24, 5)}
    <path d="M130 77h14M130 81h9" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
  `,
  coffee: ({ ink, accent, detail }) => `
    <path d="M82 66h76l-7-17H89l-7 17Z" fill="${ink}" stroke="${ink}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M86 66h68l7 61c.4 6-4 11-10 11H89c-6 0-10.4-5-10-11l7-61Z" fill="${accent}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M97 68v64M154 68v64" stroke="${ink}" stroke-width="1.6" opacity=".3"/>
    <path d="M95 50h50" stroke="${detail}" stroke-width="2" stroke-dasharray="4 4" opacity=".75"/>
    <rect x="101" y="82" width="39" height="38" rx="3" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    <ellipse cx="120" cy="98" rx="8.5" ry="11" fill="${ink}" transform="rotate(-25 120 98)"/>
    <path d="M114 92c8 4 11 8 12 12" stroke="${detail}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M109 111h6M123 111h6" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
    ${barcodeMark(108, 114, ink, 24, 4)}
    <path d="M155 78c12-8 22-4 24 4 2 9-6 17-19 17" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
  `,
  oil: ({ ink, accent, detail }) => `
    <path d="M165 62c-11-7-22-8-33-3M165 62c-3 6-4 13-3 20" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="156" cy="72" rx="7" ry="10" fill="${accent}" stroke="${ink}" stroke-width="1.8" transform="rotate(32 156 72)"/>
    <ellipse cx="174" cy="80" rx="6" ry="9" fill="${accent}" stroke="${ink}" stroke-width="1.8" transform="rotate(-22 174 80)"/>
    <rect x="111" y="32" width="20" height="17" rx="3" fill="${ink}"/>
    <path d="M105 48h32v12c0 4 7 7 9 12v42c0 8-6 14-14 14h-22c-8 0-14-6-14-14V72c2-5 9-8 9-12V48Z" fill="${ink}" stroke="${ink}" stroke-width="2.3"/>
    <path d="M102 76h38v36h-38z" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M110 92c2-6 6-10 12-13 1 8-2 15-10 19" fill="${accent}" stroke="${ink}" stroke-width="1.6"/>
    <path d="M122 98c8-5 14-4 20 1-5 6-12 8-20 5" fill="${accent}" stroke="${ink}" stroke-width="1.6"/>
    <path d="M111 109h24" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M135 55c6 10 8 16 8 23" stroke="${detail}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
  `,
  milk: ({ ink, accent, detail }) => `
    <path d="M91 58 120 39l29 19v12H91V58Z" fill="${accent}" stroke="${ink}" stroke-width="2.3" stroke-linejoin="round"/>
    <path d="M91 70h58v58c0 4-3 7-7 7H98c-4 0-7-3-7-7V70Z" fill="${detail}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M91 59v11h58V59" stroke="${ink}" stroke-width="1.7"/>
    <circle cx="120" cy="92" r="20" fill="${accent}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M112 97c2-10 6-16 12-19 1 10-2 18-9 23M116 82c-4 1-7 4-8 8" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>
    <path d="M100 120h40" stroke="${ink}" stroke-width="1.6" stroke-dasharray="3 4"/>
    <path d="M135 50h13v8h-13z" fill="${ink}"/>
    <path d="M91 78h58" stroke="${ink}" stroke-width="7" opacity=".14"/>
  `,
  bread: ({ ink, accent, detail }) => `
    <path d="M73 119c-4-27 15-58 47-58s51 31 47 58c-1 8-8 13-16 13H89c-8 0-15-5-16-13Z" fill="${accent}" stroke="${ink}" stroke-width="2.5"/>
    <path d="M92 108c4-18 12-29 26-36M111 111c2-12 8-22 18-28M128 113c1-8 5-15 12-20" stroke="${detail}" stroke-width="4" stroke-linecap="round" opacity=".85"/>
    <path d="M85 123c22 4 50 4 70 0" stroke="${ink}" stroke-width="1.5" opacity=".3"/>
    <circle cx="91" cy="80" r="2" fill="${detail}" opacity=".8"/>
    <circle cx="154" cy="93" r="1.8" fill="${detail}" opacity=".8"/>
    <path d="M74 51h28M74 58h16M164 48h13M171 55h13" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" opacity=".22"/>
  `,
  water: ({ ink, accent, detail }) => `
    <rect x="109" y="31" width="24" height="15" rx="4" fill="${accent}" stroke="${ink}" stroke-width="2"/>
    <path d="M109 46h24v9c0 4 7 7 8 13v50c0 8-6 14-14 14h-12c-8 0-14-6-14-14V68c1-6 8-9 8-13v-9Z" fill="${detail}" stroke="${ink}" stroke-width="2.3"/>
    <path d="M104 75h35v32h-35z" fill="${accent}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M107 92c5-5 10-5 15 0s10 5 15 0M107 99c5-5 10-5 15 0s10 5 15 0" stroke="${detail}" stroke-width="2" stroke-linecap="round"/>
    <path d="M112 120h19" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
    <path d="M111 53c4 8 5 15 4 22" stroke="${ink}" stroke-width="1.4" stroke-linecap="round" opacity=".25"/>
  `,
  yogurt: ({ ink, accent, detail }) => `
    <ellipse cx="120" cy="65" rx="38" ry="9" fill="${detail}" stroke="${ink}" stroke-width="2.2"/>
    <path d="M82 65c1 31 5 61 10 64 4 3 52 3 56 0 5-3 9-33 10-64" fill="${detail}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M85 79h70" stroke="${accent}" stroke-width="14" opacity=".8"/>
    <path d="M88 79h64" stroke="${ink}" stroke-width="1.4" opacity=".3"/>
    <circle cx="120" cy="99" r="12" fill="${accent}" opacity=".7"/>
    <path d="M114 99c3-6 6-8 12-8-1 5-4 8-12 11M112 105c5 2 9 2 14 0" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M113 42c13-9 27-10 40-2-10 10-23 13-38 8" fill="${accent}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M120 44c8 1 14 4 19 9" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>
  `,
  tea: ({ ink, accent, detail }) => `
    <rect x="85" y="59" width="70" height="72" rx="6" fill="${ink}" stroke="${ink}" stroke-width="2.4"/>
    <rect x="81" y="52" width="78" height="14" rx="4" fill="${accent}" stroke="${ink}" stroke-width="2.2"/>
    <rect x="93" y="76" width="54" height="41" rx="2" fill="${detail}"/>
    <path d="M120 93c-11-11-20-4-18 4 2 9 12 12 18 17 6-5 16-8 18-17 2-8-7-15-18-4Z" fill="${accent}" stroke="${ink}" stroke-width="1.6"/>
    <path d="M120 93c0 9-1 14-4 19M120 93c1 8 4 14 9 18" stroke="${ink}" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>
    <path d="M99 65h42" stroke="${detail}" stroke-width="1.5" stroke-dasharray="3 3" opacity=".6"/>
    <circle cx="166" cy="64" r="12" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M166 57v14M160 64h12" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>
  `,
  tahini: ({ ink, accent, detail }) => `
    <rect x="90" y="49" width="60" height="15" rx="5" fill="${ink}"/>
    <path d="M88 64h64v52c0 10-8 18-18 18h-28c-10 0-18-8-18-18V64Z" fill="${detail}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M91 76h58v33H91z" fill="${accent}" stroke="${ink}" stroke-width="1.8"/>
    <ellipse cx="120" cy="93" rx="15" ry="9" fill="${detail}" opacity=".85"/>
    <ellipse cx="120" cy="93" rx="8" ry="4.5" fill="${accent}" stroke="${ink}" stroke-width="1.3"/>
    <circle cx="104" cy="84" r="1.3" fill="${ink}" opacity=".5"/>
    <circle cx="133" cy="82" r="1.4" fill="${ink}" opacity=".5"/>
    <circle cx="130" cy="101" r="1.3" fill="${ink}" opacity=".5"/>
    <circle cx="109" cy="103" r="1.1" fill="${ink}" opacity=".5"/>
    <path d="M101 116h38" stroke="${ink}" stroke-width="1.4" stroke-linecap="round" opacity=".5"/>
    <path d="M151 81c8-11 15-14 22-12-1 10-7 17-18 20" fill="${accent}" stroke="${ink}" stroke-width="1.7"/>
  `,
  juice: ({ ink, accent, detail }) => `
    <rect x="112" y="30" width="18" height="13" rx="3" fill="${ink}"/>
    <path d="M107 43h28v9c0 4 8 7 9 13v51c0 8-6 14-14 14h-18c-8 0-14-6-14-14V65c1-6 9-9 9-13v-9Z" fill="${accent}" stroke="${ink}" stroke-width="2.4"/>
    <rect x="101" y="75" width="40" height="34" rx="4" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    <circle cx="120" cy="90" r="11" fill="${accent}" stroke="${ink}" stroke-width="1.6"/>
    <path d="M114 82l2-6 4 4 4-5 1 6 6-2-3 6" fill="${accent}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>
    <circle cx="116" cy="89" r="1.2" fill="${ink}"/><circle cx="122" cy="87" r="1.2" fill="${ink}"/><circle cx="119" cy="93" r="1.2" fill="${ink}"/><circle cx="125" cy="93" r="1.1" fill="${ink}"/>
    <path d="M108 118h24" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
    <path d="M151 58c7-7 14-8 20-4-4 8-10 12-19 12" fill="${detail}" stroke="${ink}" stroke-width="1.7"/>
  `,
  eggs: ({ ink, accent, detail }) => `
    <path d="M75 86l12-11h66l12 11v32c0 8-7 14-15 14H90c-8 0-15-6-15-14V86Z" fill="${accent}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M82 89h76v18H82z" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M88 72c2-14 10-23 17-23 8 0 14 10 15 24 .4 6-5 10-15 10-11 0-17-4-17-11Z" fill="${detail}" stroke="${ink}" stroke-width="2"/>
    <path d="M116 69c1-15 9-25 17-25 8 0 14 10 15 25 .3 6-6 10-16 10-11 0-16-4-16-10Z" fill="${detail}" stroke="${ink}" stroke-width="2"/>
    <path d="M144 73c1-13 8-22 15-22 8 0 14 9 15 22 .3 6-6 9-15 9-10 0-15-3-15-9Z" fill="${detail}" stroke="${ink}" stroke-width="2"/>
    <path d="M88 117h63" stroke="${ink}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".5"/>
    <path d="M100 95c15 3 30 3 44 0" stroke="${ink}" stroke-width="1.2" opacity=".2"/>
    <circle cx="99" cy="84" r="1.2" fill="${ink}" opacity=".35"/>
    <circle cx="150" cy="80" r="1.3" fill="${ink}" opacity=".35"/>
  `,
  honey: ({ ink, accent, detail }) => `
    <path d="M159 45l-10 67" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
    <path d="M159 45c9-5 15-2 16 4 1 7-6 12-15 10" fill="${accent}" stroke="${ink}" stroke-width="1.8"/>
    <rect x="91" y="50" width="58" height="14" rx="5" fill="${ink}"/>
    <path d="M88 64h64v52c0 10-8 18-18 18h-28c-10 0-18-8-18-18V64Z" fill="${accent}" stroke="${ink}" stroke-width="2.4"/>
    <path d="M94 77h52v34H94z" fill="${detail}" stroke="${ink}" stroke-width="1.7"/>
    <path d="M120 83l8 4.5v9L120 101l-8-4.5v-9L120 83Z" fill="${accent}" stroke="${ink}" stroke-width="1.4"/>
    <path d="M120 88l4 2.3v4.4l-4 2.3-4-2.3v-4.4L120 88Z" fill="${detail}"/>
    <path d="M101 70c3 3 6 5 9 5M141 70c-3 3-6 5-9 5" stroke="${detail}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
    <g fill="${ink}" opacity=".3"><circle cx="70" cy="105" r="2"/><circle cx="62" cy="90" r="1.3"/><circle cx="73" cy="82" r="1"/></g>
  `,
  cheese: ({ ink, accent, detail }) => `
    <path d="M78 78l58-24 29 18-82 43-5-37Z" fill="${accent}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M83 115l82-43v18c0 6-2 10-8 13l-51 27c-10 5-22 1-23-15Z" fill="${detail}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <ellipse cx="109" cy="95" rx="7" ry="4.5" fill="${accent}" opacity=".65"/>
    <ellipse cx="133" cy="82" rx="5.5" ry="3.4" fill="${accent}" opacity=".65"/>
    <ellipse cx="131" cy="112" rx="6" ry="3.5" fill="${accent}" opacity=".65"/>
    <ellipse cx="149" cy="101" rx="4" ry="2.5" fill="${accent}" opacity=".65"/>
    <path d="M98 76l-6-19M91 57l-9 2 7 6" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M159 67c1 7 1 13-1 18" stroke="${ink}" stroke-width="1.3" opacity=".3"/>
  `,
  cookie: ({ ink, accent, detail }) => `
    <circle cx="120" cy="94" r="41" fill="${accent}" stroke="${ink}" stroke-width="2.5"/>
    <circle cx="120" cy="94" r="31" fill="none" stroke="${detail}" stroke-width="2" stroke-dasharray="2 5" opacity=".75"/>
    <path d="M120 72l6.5 13 14 2.5-10.5 10 2.5 14-12.5-7-12.5 7 2.5-14-10.5-10 14-2.5L120 72Z" fill="${detail}" opacity=".7"/>
    <circle cx="104" cy="80" r="1.5" fill="${ink}" opacity=".45"/>
    <circle cx="139" cy="92" r="1.4" fill="${ink}" opacity=".45"/>
    <circle cx="111" cy="112" r="1.4" fill="${ink}" opacity=".45"/>
    <circle cx="147" cy="113" r="1" fill="${ink}" opacity=".4"/>
    <path d="M88 118c20 10 44 10 66 0" stroke="${ink}" stroke-width="1.3" opacity=".2"/>
    <path d="M165 61c8-3 14 1 15 7-7 3-14 1-17-4" fill="${detail}" stroke="${ink}" stroke-width="1.6"/>
  `,
  detergent: ({ ink, accent, detail }) => `
    <path d="M147 56c0-9-5-15-14-15h-9v14h9c3 0 5 2 5 6v14" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="107" y="31" width="25" height="15" rx="3" fill="${ink}"/>
    <path d="M102 46h37l11 21v53c0 9-7 16-16 16H94c-9 0-16-7-16-16V71l10-25h14Z" fill="${accent}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M147 59c12 2 20 9 21 19" stroke="${ink}" stroke-width="8" opacity=".16" stroke-linecap="round"/>
    <rect x="88" y="76" width="54" height="42" rx="4" fill="${detail}" stroke="${ink}" stroke-width="1.8"/>
    <path d="M98 91c5-7 12-10 20-9-2 8-7 13-15 16" fill="${accent}" stroke="${ink}" stroke-width="1.5"/>
    <circle cx="135" cy="92" r="5" fill="${accent}" opacity=".55"/>
    <circle cx="128" cy="105" r="3.4" fill="${accent}" opacity=".55"/>
    <circle cx="139" cy="108" r="2.3" fill="${accent}" opacity=".55"/>
    <path d="M106 110h22" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
    <g fill="none" stroke="${ink}" opacity=".22"><circle cx="175" cy="88" r="4"/><circle cx="187" cy="73" r="2.5"/><circle cx="169" cy="105" r="2"/></g>
  `,
  pantry: ({ ink, accent, detail }) => `
    <path d="M87 55h66l8 13v55c0 8-6 14-14 14H93c-8 0-14-6-14-14V68l8-13Z" fill="${accent}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M82 72h76" stroke="${ink}" stroke-width="1.8"/>
    <path d="M92 60h56" stroke="${detail}" stroke-width="2" stroke-dasharray="4 4" opacity=".8"/>
    <rect x="100" y="83" width="40" height="32" rx="3" fill="${detail}" stroke="${ink}" stroke-width="1.7"/>
    <path d="M114 96h12M120 90v12" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
    ${barcodeMark(106, 106, ink, 28, 5)}
    <path d="M168 53c9-4 16 0 17 7-8 3-15 0-18-5" fill="${detail}" stroke="${ink}" stroke-width="1.6"/>
  `
};

export function getProductPalette(kind) {
  return palettes[kind] || palettes.pantry;
}

export function productArt(kind = 'pantry', { className = '' } = {}) {
  const palette = getProductPalette(kind);
  const draw = drawings[kind] || drawings.pantry;
  return `<div class="product-art ${className}" style="--art-bg:${palette.bg};--art-ink:${palette.ink};--art-accent:${palette.accent};--art-detail:${palette.detail}" aria-hidden="true">
    <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity=".55">
        <circle cx="190" cy="38" r="33" fill="${palette.accent}" opacity=".17"/>
        <circle cx="53" cy="119" r="3" fill="${palette.ink}" opacity=".2"/>
        <path d="M27 45h24M27 52h15M188 133h26M196 140h18" stroke="${palette.ink}" stroke-width="1.8" stroke-linecap="round" opacity=".18"/>
        <path d="M32 78c7-8 14-8 21 0" stroke="${palette.ink}" stroke-width="1.5" stroke-linecap="round" opacity=".18"/>
      </g>
      <ellipse cx="120" cy="141" rx="53" ry="6.5" fill="${palette.ink}" opacity=".1"/>
      <g style="stroke-linecap:round;stroke-linejoin:round">${draw(palette)}</g>
    </svg>
  </div>`;
}

export const artKinds = Object.keys(palettes);

export const ART_LABELS = {
  dates: 'تمور',
  coffee: 'قهوة',
  oil: 'زيوت',
  milk: 'حليب',
  bread: 'مخبوزات',
  water: 'مياه',
  yogurt: 'ألبان',
  tea: 'شاي',
  tahini: 'طحينة',
  juice: 'عصائر',
  eggs: 'بيض',
  honey: 'عسل',
  cheese: 'أجبان',
  cookie: 'حلويات',
  detergent: 'منظفات',
  pantry: 'بقالة'
};

export function inferArtKind(name = '', category = '') {
  const text = `${name} ${category}`;
  const rules = [
    ['coffee', /قهوة|بن /],
    ['tea', /شاي|اعشاب|أعشاب/],
    ['dates', /تمر|سكري|خلاص/],
    ['honey', /عسل/],
    ['cookie', /معمول|كعك|بسكويت|حلوى|حلويات/],
    ['oil', /زيت|زيتون/],
    ['milk', /حليب|لبن|دسم/],
    ['yogurt', /زبادي|روب|لبنة/],
    ['cheese', /جبن|حلوم|لبنة/],
    ['bread', /خبز|تنور|صمون/],
    ['water', /ماء|مياه|معدني/],
    ['juice', /عصير|رمان|برتقال/],
    ['eggs', /بيض/],
    ['detergent', /صابون|منظف|غسيل|تنظيف/],
    ['tahini', /طحينة|سمسم/]
  ];
  for (const [kind, expression] of rules) {
    if (expression.test(text)) return kind;
  }
  return 'pantry';
}
