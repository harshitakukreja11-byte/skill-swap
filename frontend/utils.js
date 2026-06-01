// frontend/utils.js
(function () {
  window.getToken = function () {
    return localStorage.getItem("token");
  };
  window.setToken = function (token) {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  };
  window.authFetch = async function (url, opts = {}) {
    const token = window.getToken();
    opts.headers = opts.headers || {};
    if (token) opts.headers["Authorization"] = "Bearer " + token;
    const res = await fetch(url, opts);
    if (res.status === 401) {
      // session expired / not authorized
      alert("Session expired. Please log in again.");
      window.setToken(null);
      window.location.href = "login.html";
      throw new Error("Unauthorized");
    }
    // return parsed JSON or throw
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch (err) {
      // not JSON
      throw new Error("Invalid JSON response: " + txt);
    }
  };
})();
