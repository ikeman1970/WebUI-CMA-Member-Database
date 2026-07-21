#!/bin/bash
# Execute RLS security tests against Supabase database

# Parse database URL to extract connection details
DIRECT_URL=${DIRECT_URL:-"postgresql://postgres.cldgzfqoldsdpgcugbcj:WcE15ZQ8nQczz1Qa@aws-1-us-east-2.pooler.supabase.com:5432/postgres?schema=app"}

# Try to find a working psql
PSQL=$(which psql 2>/dev/null)

if [ -z "$PSQL" ]; then
  # Try common macOS paths
  if [ -x /opt/homebrew/bin/psql ]; then
    PSQL=/opt/homebrew/bin/psql
  elif [ -x /opt/local/bin/psql ]; then
    PSQL=/opt/local/bin/psql
  else
    echo "❌ psql not found. Trying alternative approach..."
    # Use python/sqlite if available
    PSQL=""
  fi
fi

if [ -n "$PSQL" ]; then
  echo "✓ Found psql at: $PSQL"
  $PSQL "$DIRECT_URL" < security-rls-tests.sql 2>&1
else
  echo "❌ ERROR: No SQL client found"
  echo "This system appears to have CPU architecture incompatibil  echo "This system appears to have CPU architectusing Supabase UI or local psql"
  exit 1
fi
