import React, { useState } from "react";

export default function MpinInput({ value = "", onChange, disabled = false, name = "mpin", autoFocus = false, placeholder = "6-digit MPIN", id }) {
  const [show, setShow] = useState(false);
  const handle = (e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6));
  return (
    <div className="mpin-input-row">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={handle}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button
        type="button"
        className="mpin-toggle"
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        aria-label={show ? "Hide MPIN" : "Show MPIN"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}