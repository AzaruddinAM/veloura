#!/usr/bin/env bash
# Works out, over FTP, where the site (public_html) and the backend (veloura) are
# relative to the folder the FTP login opens in, and writes PUBLIC_DIR / APP_DIR
# to $GITHUB_ENV. Uses only listings of folders that exist (Hostinger makes checks
# of missing paths wait for a timeout), each limited to a few seconds.
#
# Also removes public_html/domains/, the copy an earlier deploy put there by mistake.
#
# Needs: FTP_HOST, FTP_USERNAME, FTP_PASSWORD, RUNNER_TEMP, optional FTP_PUBLIC_DIR / FTP_APP_DIR.
set -uo pipefail

ftp() {
  timeout "${2:-30}" lftp -u "$FTP_USERNAME,$FTP_PASSWORD" "$FTP_HOST" \
    -e "source $RUNNER_TEMP/lftp-settings; set net:max-retries 1; set net:timeout 10; set cmd:fail-exit no; $1; bye" 2>/dev/null
}
list() { ftp "cls -1 -a \"${1:-.}\"" "${2:-30}" | awk '{ d = sub(/\/$/, ""); n = split($0, p, "/"); print p[n] (d ? "/" : "") }'; }
in_list() { grep -qx "$2" <<< "$1"; }
is_site() { in_list "$1" 'index.php' && in_list "$1" 'adminpannel/'; }
is_app() { in_list "$1" 'artisan' && in_list "$1" 'vendor/'; }

found() {
  echo "Site folder:    '${1:-./}'"
  echo "Backend folder: '$2'"
  echo "::notice::FTP folders found: site '${1:-./}', backend '$2'"
  echo "PUBLIC_DIR=$1" >> "$GITHUB_ENV"
  echo "APP_DIR=$2" >> "$GITHUB_ENV"
  exit 0
}

if [ -n "${FTP_PUBLIC_DIR:-}" ] && [ -n "${FTP_APP_DIR:-}" ]; then
  found "$FTP_PUBLIC_DIR" "$FTP_APP_DIR"
fi

root=$(list .)
echo "Top-level entries: $(tr '\n' ' ' <<< "$root")"
[ -z "$root" ] && { echo "::error::Could not log in or list the FTP folder. Check FTP_USERNAME / FTP_PASSWORD."; exit 1; }

# Login opens in the home folder or in the domain folder.
if in_list "$root" 'domains/'; then
  d=$(list domains/velourajewels.online)
  if in_list "$d" 'public_html/' && in_list "$d" 'veloura/' && ! is_site "$root"; then
    found 'domains/velourajewels.online/public_html/' 'domains/velourajewels.online/veloura/'
  fi
fi
if in_list "$root" 'public_html/' && in_list "$root" 'veloura/'; then
  found 'public_html/' 'veloura/'
fi

# Login opens inside public_html (this account): the backend is ../veloura if reachable.
if is_site "$root"; then
  if in_list "$root" 'domains/'; then
    echo "Removing public_html/domains/ (a copy a previous deploy put there by mistake)."
    ftp 'rm -r -f domains' 120 > /dev/null
  fi
  up=$(list ../veloura 20)
  if is_app "$up"; then found '' '../veloura/'; fi
  echo "::error::This FTP account opens inside public_html and cannot reach the backend folder 'veloura' next to it, so the backend can't be deployed with it. In hPanel > Files > FTP Accounts, use an FTP account whose folder is the one that contains public_html and veloura, and put its login in the FTP_USERNAME / FTP_PASSWORD secrets."
  exit 1
fi

echo "::error::Could not find the site (index.php, adminpannel/) and backend (artisan, vendor/) over FTP. Set the repository variables FTP_PUBLIC_DIR and FTP_APP_DIR."
exit 1
