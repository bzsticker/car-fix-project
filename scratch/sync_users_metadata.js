/* eslint-disable */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Manually parse .env.local
let supabaseUrl = "";
let supabaseServiceKey = "";

try {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        if (key === "NEXT_PUBLIC_SUPABASE_URL") {
          supabaseUrl = value.trim();
        } else if (key === "SUPABASE_SERVICE_ROLE_KEY") {
          supabaseServiceKey = value.trim();
        }
      }
    }
  }
} catch (e) {
  console.error("Failed to parse .env.local", e);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const usersToSync = [
  {
    email: "owner@denmodify.com",
    id: "38231abe-8474-4105-97ae-2a4bd55c9cf0",
    metadata: { role: "owner", branch_id: null, full_name: "Owner" }
  },
  {
    email: "admin1@denmodify.com",
    id: "1fc3cd5d-da9b-4a17-b95c-6725fb950546",
    metadata: { role: "admin", branch_id: "1c61a46f-72c1-497a-b601-b7780f98e767", full_name: "Admin Rayong HQ" }
  },
  {
    email: "admin2@denmodify.com",
    id: "75f2b02c-37d9-401b-b227-48391b702e85",
    metadata: { role: "admin", branch_id: "ff2c3c35-55d6-4d9e-a01d-db907ce25d41", full_name: "Admin Rayong Branch 2" }
  },
  {
    email: "tech1@denmodify.com",
    id: "2184f282-d1fa-4280-933c-daaed731b1a0",
    metadata: { role: "technician", branch_id: "1c61a46f-72c1-497a-b601-b7780f98e767", full_name: "Technician 1 HQ" }
  },
  {
    email: "tech2@denmodify.com",
    id: "4c147e75-46f8-4b25-ad9f-4e63982a0ee0",
    metadata: { role: "technician", branch_id: "1c61a46f-72c1-497a-b601-b7780f98e767", full_name: "Technician 2 HQ" }
  },
  {
    email: "tech3@denmodify.com",
    id: "da7bd717-efb7-4071-a14d-d661412ec759",
    metadata: { role: "technician", branch_id: "ff2c3c35-55d6-4d9e-a01d-db907ce25d41", full_name: "Technician 3 Branch 2" }
  },
  {
    email: "tech4@denmodify.com",
    id: "da99c953-2145-4c1c-a549-d2516c7959ea",
    metadata: { role: "technician", branch_id: "ff2c3c35-55d6-4d9e-a01d-db907ce25d41", full_name: "Technician 4 Branch 2" }
  }
];

async function syncUsers() {
  console.log("=== STARTING AUTH USER METADATA SYNCHRONIZATION ===");
  for (const user of usersToSync) {
    console.log(`Syncing ${user.email} (${user.id})...`);
    
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { user_metadata: user.metadata }
    );
    
    if (error) {
      console.error(`Failed to sync ${user.email}:`, error.message);
    } else {
      console.log(`Successfully synced metadata for ${user.email}`);
    }
  }
  console.log("=== METADATA SYNCHRONIZATION COMPLETE ===");
}

syncUsers();
