// =========================================================
// KASHIE NETLIFY API PROXY
// File: netlify/functions/api.js
// =========================================================

exports.handler = async function (event) {
    const allowedMethods = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ];

    const method = event.httpMethod;

    if (!allowedMethods.includes(method)) {
        return {
            statusCode: 405,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                message: "Method not allowed."
            })
        };
    }

    if (method === "OPTIONS") {
        return {
            statusCode: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers":
                    "Content-Type, Authorization",
                "Access-Control-Allow-Methods":
                    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            },
            body: ""
        };
    }

    const backendUrl = process.env.KASHIE_API_URL;

    if (!backendUrl) {
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                message: "KASHIE_API_URL is not configured."
            })
        };
    }

    try {
        const incomingPath =
            event.path.replace(/^\/\.netlify\/functions\/api\/?/, "");

        const queryString = event.rawQuery
            ? `?${event.rawQuery}`
            : "";

        const baseUrl = backendUrl.replace(/\/+$/, "");

        const targetUrl =
            `${baseUrl}/${incomingPath}${queryString}`;

        const headers = {};

        for (const [key, value] of Object.entries(
            event.headers || {}
        )) {
            const normalizedKey = key.toLowerCase();

            if (
                normalizedKey === "authorization" ||
                normalizedKey === "content-type" ||
                normalizedKey === "accept"
            ) {
                headers[normalizedKey] = value;
            }
        }

        const response = await fetch(targetUrl, {
            method,
            headers,
            body:
                method === "GET" || method === "HEAD"
                    ? undefined
                    : event.body || undefined
        });

        const responseBody = await response.text();

        return {
            statusCode: response.status,
            headers: {
                "Content-Type":
                    response.headers.get("content-type") ||
                    "application/json",
                "Cache-Control": "no-store"
            },
            body: responseBody
        };
    } catch (error) {
        console.error("KASHIE API proxy error:", error.message);

        return {
            statusCode: 502,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: false,
                message: "The KASHIE backend could not be reached."
            })
        };
    }
};
Important configuration
In your Netlify site's environment variables, add:
KASHIE_API_URL = https://YOUR-RENDER-SERVICE.onrender.com/api
Replace the example address with the actual URL of your KASHIE Render service.
This proxy expects the backend URL to end in /api. For example, a request to:
/.netlify/functions/api/health
will be forwarded to:
https://YOUR-RENDER-SERVICE.onrender.com/api/health
