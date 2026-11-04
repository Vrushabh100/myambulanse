import React from "react";
import { Link } from "react-router-dom";

export default function UnderReviewPage() {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Account under review</h2>
        <div className="notice">
          Your doctor account has been created successfully and is now <b>under review</b>.
          Your account will be approved by the administration after a successful review.
          You will be able to log in once it is approved.
        </div>
        <p className="hint">
          Questions? Call MyAmbulance customer care{" "}
          <a className="cc-link" href="tel:+918007470450">+91 8007470450</a>.
        </p>
        <Link className="btn primary wide" to="/auth/login">Back to login</Link>
      </div>
    </div>
  );
}