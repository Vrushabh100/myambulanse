import React from "react";

const SVG = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false"
};

function Svg({ size = 20, children, ...rest }) {
  return (
    <svg {...SVG} width={size} height={size} {...rest}>
      {children}
    </svg>
  );
}

export function IconUsers({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function IconCar({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M19 17h2a1 1 0 0 0 1-1v-3.5a1.5 1.5 0 0 0-.4-1l-2.1-2.4a2 2 0 0 0-1.5-.7H5.9a2 2 0 0 0-1.5.7l-2.1 2.4a1.5 1.5 0 0 0-.4 1V16a1 1 0 0 0 1 1h2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="M9 17h6" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconStethoscope({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M3.5 3h3" />
      <path d="M13.5 3h3" />
      <path d="M10 14v1a5 5 0 0 0 10 0v-2.5" />
      <circle cx="20" cy="10" r="2" />
    </Svg>
  );
}

export function IconPhone({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Svg>
  );
}

export function IconAmbulance({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M2 17V8a1 1 0 0 1 1-1h9v10" />
      <path d="M12 9h4l4 3.5V17h-2" />
      <path d="M14 12.5h3.2" />
      <path d="M6 10.5h3" />
      <path d="M7.5 9v3" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
      <path d="M8.8 17.5h6.4" />
    </Svg>
  );
}

export function IconSiren({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M7 18v-6a5 5 0 0 1 10 0v6" />
      <path d="M5 21a1 1 0 0 0 1-1h12a1 1 0 0 0 1 1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v1z" />
      <path d="M12 2v2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M19.1 4.9l-1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </Svg>
  );
}

export function IconWhatsApp({ size, ...rest }) {
  return (
    <Svg size={size} {...rest}>
      <path d="M20.5 11.6A8.5 8.5 0 0 1 7.8 18.6L3.5 20l1.4-4.1A8.5 8.5 0 1 1 20.5 11.6z" />
      <path d="M9.2 9c.2-.3.5-.4.8-.3l1 .4c.3.1.4.5.3.8l-.2.5c.4.8 1.1 1.5 1.9 1.9l.5-.2c.3-.1.7 0 .8.3l.4 1c.1.3 0 .6-.3.8-.6.4-1.4.5-2.1.2-1.9-.8-3.4-2.3-4.2-4.2-.3-.7-.2-1.5.2-2.1z" />
    </Svg>
  );
}
