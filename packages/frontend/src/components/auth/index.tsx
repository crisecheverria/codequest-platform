// packages/frontend/src/components/auth/index.tsx
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import api from "../../api/config";

export const Login = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get("error");

  const state = location.state as {
    returnTo?: string;
    message?: string;
  } | null;

  const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Handle error parameter
    if (errorParam === "session_expired") {
      setErrorMessage("Your session has expired. Please log in again.");
    }
  }, [errorParam]);

  const handleGitHubLogin = () => {
    // Save return URL in localStorage
    if (state?.returnTo) {
      localStorage.setItem("returnTo", state.returnTo);
    } else if (localStorage.getItem("redirectAfterLogin")) {
      // Keep the redirect if it was set by the interceptor
    } else {
      // Default to dashboard
      localStorage.setItem("returnTo", "/dashboard");
    }

    const REDIRECT_URI = import.meta.env.VITE_GITHUB_CALLBACK_URL;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to CodeQuest
        </h2>
        {errorMessage && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{errorMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {state?.message && !errorMessage && (
          <p className="mt-2 text-center text-sm text-gray-600">
            {state.message}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <button
            onClick={handleGitHubLogin}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Continue with GitHub
          </button>
        </div>
      </div>
    </div>
  );
};

export const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing authentication...");
  const hasProcessed = useRef(false);

  useEffect(() => {
    const handleAuth = async () => {
      // Prevent double execution in React Strict Mode
      if (hasProcessed.current) {
        return;
      }
      hasProcessed.current = true;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const token = urlParams.get("token");

        // Handle direct token from backend redirect (from /auth/success)
        if (token) {
          setStatus("Processing authentication...");
          localStorage.setItem("token", token);

          // Fetch user data after getting token
          try {
            setStatus("Fetching user profile...");
            const userResponse = await api.get("/api/auth/me", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            localStorage.setItem("user", JSON.stringify(userResponse.data));
          } catch (userError) {
            console.error("Error fetching user profile:", userError);
            // Continue anyway, user profile can be fetched later
          }

          // Check for return URL
          const returnTo = localStorage.getItem("returnTo") || "/dashboard";
          localStorage.removeItem("returnTo"); // Clean up
          localStorage.removeItem("redirectAfterLogin"); // Clean up

          // Navigate to return URL or dashboard
          navigate(returnTo);
          return;
        }

        // Handle OAuth code exchange (from /auth/github/callback)
        if (!code) {
          throw new Error("No authorization code or token received");
        }

        setStatus("Exchanging code for token...");

        const response = await api.post("/api/auth/github", { code });
        const data = response.data;

        if (data.token) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));

          // Check for return URL
          const returnTo = localStorage.getItem("returnTo") || "/dashboard";
          localStorage.removeItem("returnTo"); // Clean up
          localStorage.removeItem("redirectAfterLogin"); // Clean up

          // Navigate to return URL or dashboard
          navigate(returnTo);
        } else {
          throw new Error("No token received");
        }
      } catch (err) {
        console.error("Authentication error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
      }
    };

    handleAuth();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Authentication Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Return to Login
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-800"></div>
          </div>
          <p className="mt-4 text-center text-gray-600">{status}</p>
        </div>
      </div>
    </div>
  );
};
