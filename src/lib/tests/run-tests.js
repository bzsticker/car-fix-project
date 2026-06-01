import assert from "node:assert/strict";

function simulateMiddleware(request, user, profile) {
  const { pathname } = request.nextUrl;

  const isDashboardPath = pathname.startsWith("/owner") || 
                          pathname.startsWith("/branch") || 
                          pathname.startsWith("/tech");

  if (!user && isDashboardPath) {
    return { status: 307, redirect: "/login" };
  }

  if (user && profile) {
    const role = profile.role;

    if (pathname === "/login" || pathname === "/") {
      if (role === "owner") {
        return { status: 307, redirect: "/owner" };
      }

      if (role === "admin") {
        return { status: 307, redirect: "/branch" };
      }

      return { status: 307, redirect: "/tech" };
    }

    if (pathname.startsWith("/owner") && role !== "owner") {
      return { status: 307, redirect: "/login" };
    }

    if (pathname.startsWith("/branch") && role !== "admin" && role !== "owner") {
      return { status: 307, redirect: "/login" };
    }

    if (pathname.startsWith("/tech") && role !== "technician" && role !== "owner") {
      return { status: 307, redirect: "/login" };
    }
  }

  return { status: 200, redirect: null };
}

function validateCustomerInput(body) {
  if (!body.full_name || typeof body.full_name !== "string" || body.full_name.trim().length === 0) {
    return { valid: false, error: "Name must be a valid non-empty string" };
  }

  if (!body.phone || !/^\+?[0-9-]{9,15}$/.test(body.phone)) {
    return { valid: false, error: "Phone number is malformed or invalid" };
  }

  return { valid: true, error: null };
}

try {
  console.log("=== STARTING AUTOMATED UNIT TESTS ===");

  console.log("Running: Test unauthenticated block...");
  const res1 = simulateMiddleware(
    { nextUrl: { pathname: "/branch" }, url: "http://localhost/branch", cookies: {} },
    null,
    null,
  );
  assert.equal(res1.status, 307);
  assert.equal(res1.redirect, "/login");
  console.log("PASS: Unauthenticated block");

  console.log("Running: Test Owner redirection...");
  const res2 = simulateMiddleware(
    { nextUrl: { pathname: "/login" }, url: "http://localhost/login", cookies: {} },
    { id: "user-owner" },
    { id: "user-owner", role: "owner" },
  );
  assert.equal(res2.status, 307);
  assert.equal(res2.redirect, "/owner");
  console.log("PASS: Owner dashboard routing");

  console.log("Running: Test Tech route isolation...");
  const res3 = simulateMiddleware(
    { nextUrl: { pathname: "/owner" }, url: "http://localhost/owner", cookies: {} },
    { id: "user-tech" },
    { id: "user-tech", role: "technician" },
  );
  assert.equal(res3.status, 307);
  assert.equal(res3.redirect, "/login");
  console.log("PASS: Tech route isolation");

  console.log("Running: Test customer inputs validator...");
  const val1 = validateCustomerInput({ full_name: "Apinan", phone: "+66815550199" });
  assert.equal(val1.valid, true);

  const val2 = validateCustomerInput({ full_name: "", phone: "+66815550199" });
  assert.equal(val2.valid, false);
  assert.match(val2.error, /Name/);

  const val3 = validateCustomerInput({ full_name: "Chaiwat", phone: "short" });
  assert.equal(val3.valid, false);
  assert.match(val3.error, /Phone/);
  console.log("PASS: Customer validation rules");

  console.log("=== ALL UNIT TESTS COMPLETED SUCCESSFULLY ===");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("UNIT TEST FAILED:", message);
  process.exit(1);
}
