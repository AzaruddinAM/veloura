#!/usr/bin/env bash
# Works out, over FTP, where the site (public_html) and the backend (veloura) are
# relative to the folder the FTP login opens in, and writes PUBLIC_DIR / APP_DIR
# to $GITHUB_ENV. A folder only counts when the files of a running site are there:
#   public_html: index.php and adminpannel/index.html
#   veloura:     vendor/autoload.php and artisan
#
# Also removes the copy an earlier deploy put inside public_html by mistake
# (public_html/domains/velourajewels.online/...), recognised by its .deployed-commit.
#
# Needs: FTP_HOST, FTP_USERNAME, FTP_PASSWORD, RUNNER_TEMP, optional FTP_PUBLIC_DIR / FTP_APP_DIR.
set -uo pipefail

ftp() { timeout 90 lftp -u "$FTP_USERNAME,$FTP_PASSWORD" "$FTP_HOST" -e "source $RUNNER_TEMP/lftp-settings; $1; bye" 2>/dev/null; }
has() { ftp "set net:max-retries 1; cat \"$1\"" > /dev/null; }
site_at() { has "${1}index.php" && has "${1}adminpannel/index.html"; }
app_at() { has "${1}vendor/autoload.php" && has "${1}artisan"; }

echo "FTP login opens in: $(ftp 'pwd' | head -1)"
echo "Top-level entries: $(ftp 'set net:max-retries 1; cls -1 -a' | tr '\n' ' ')"

candidates=()
[ -n "${FTP_PUBLIC_DIR:-}" ] && [ -n "${FTP_APP_DIR:-}" ] && candidates+=("$FTP_PUBLIC_DIR|$FTP_APP_DIR")
candidates+=(
  "domains/velourajewels.online/public_html/|domains/velourajewels.online/veloura/"  # login at home folder
  "public_html/|veloura/"                                                          # login at the domain folder
  "|../veloura/"                                                                   # login inside public_html
)

for c in "${candidates[@]}"; do
  pub=${c%%|*} app=${c#*|}
  if site_at "$pub" && app_at "$app"; then
    echo "Site folder:    '${pub:-./}'"
    echo "Backend folder: '$app'"
    echo "PUBLIC_DIR=$pub" >> "$GITHUB_ENV"
    echo "APP_DIR=$app" >> "$GITHUB_ENV"

    stray="${pub}domains/velourajewels.online"
    if [ "$pub" != "domains/velourajewels.online/public_html/" ] && has "$stray/veloura/.deployed-commit"; then
      echo "Removing the copy a previous deploy left in ${pub:-./}domains/ by mistake."
      ftp "rm -r -f \"$stray\"; rmdir \"${pub}domains\"" || true
    fi
    exit 0
  fi
done

if site_at ""; then
  echo "::error::This FTP account opens inside public_html and cannot reach the backend folder (veloura) next to it. In hPanel > Files > FTP Accounts use the main FTP account, or create one whose folder is the domain folder (the one that contains public_html and veloura), and put its login in the FTP_USERNAME / FTP_PASSWORD secrets."
else
  echo "::error::Could not find the site (index.php, adminpannel/) and backend (vendor/, artisan) over FTP. Set the repository variables FTP_PUBLIC_DIR and FTP_APP_DIR to their paths as seen from the FTP login folder."
fi
exit 1
