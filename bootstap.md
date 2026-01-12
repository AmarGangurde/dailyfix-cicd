====================================================
PHASE 1 — SERVER PREPARATION (FOUNDATION)
=====================================================


### Update and harden base system ###

sudo apt update && sudo apt -y upgrade
sudo apt -y install ca-certificates curl gnupg lsb-release ufw

### Firewall lock-down ###

sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

- varify -
sudo ufw status
- expected -
22/tcp ALLOW
80/tcp ALLOW
443/tcp ALLOW

### Install Docker Engine ###

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

- Log out and back in: -
exit
ssh ubuntu@<YOUR_EC2_PUBLIC_IP>
- validate -
docker --version

### Install Docker Compose plugin ###

sudo apt install -y docker-compose-plugin
docker compose version

### Create Matrix project directory ###

sudo mkdir -p /opt/matrix
sudo chown ubuntu:ubuntu /opt/matrix
cd /opt/matrix

### Clean-room validation ###

docker ps -a
ls -la /opt/matrix


===========================================================
PHASE 2 — MATRIX CORE (SYNAPSE)
===========================================================

### Create Synapse directory structure ###

cd /opt/matrix
mkdir synapse data nginx element whatsapp

### Generate Synapse base config ###

docker run -it --rm \
  -v /opt/matrix/synapse:/data \
  -e SYNAPSE_SERVER_NAME=matrix.wrexer.com \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate


### Create Synapse Postgres Volume ###

docker volume create synapse-pgdata

### add to docker-compose ###

- edit nano /opt/matrix/docker-compose.yml -

  synapse-db:
    image: postgres:15
    container_name: synapse-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: synapse
      POSTGRES_USER: synapse
      POSTGRES_PASSWORD: STRONG_PASSWORD
      POSTGRES_INITDB_ARGS: "--locale=C --encoding=UTF8"
    volumes:
      - synapse-pgdata:/var/lib/postgresql/data
    networks:
      - matrix


- Ensure volume block at bottom: -
volumes:
  synapse-pgdata:

### Initialize DB ###

docker run --rm \
  -u 999:999 \
  -v synapse-pgdata:/var/lib/postgresql/data \
  postgres:15 \
  initdb -D /var/lib/postgresql/data --locale=C --encoding=UTF8


### Secure the homeserver ###

nano /opt/matrix/synapse/homeserver.yaml

- Set: -
enable_registration: false
enable_registration_without_verification: false

- Find listeners: and confirm: -
- port: 8008
  tls: false
  type: http
  x_forwarded: true
  resources:
    - names: [client, federation]
      compress: false

### edit database section of homeserver.yaml ###

database:
  name: psycopg2
  allow_unsafe_locale: true
  args:
    user: synapse
    password: STRONG_PASSWORD
    database: synapse
    host: synapse-db
    port: 5432

### Create Synapse compose file ###

nano /opt/matrix/docker-compose.yml

- set -
version: "3.8"

services:
  synapse:
    image: matrixdotorg/synapse:latest
    container_name: synapse
    restart: unless-stopped
    volumes:
      - ./synapse:/data
    environment:
      - SYNAPSE_SERVER_NAME=matrix.wrexer.com
      - SYNAPSE_REPORT_STATS=no
    networks:
      - matrix
networks:
  matrix:
- edit this -
    ports:
      - "29318:29318"

### Start Synapse ###

docker compose up -d

- Validate -
docker ps
ss -lntp | grep 8008

- expected -
Synapse running
Port 8008 listening

### ownership of Synapse data ###

sudo chown -R 991:991 /opt/matrix/synapse
sudo chmod -R 755 /opt/matrix/synapse


### RESTART SYNAPSE ### 

docker restart synapse

# IMP #
Synapse must be lifecycle-managed manually or by controlled Terraform/Ansible — not by “docker compose up” in CI.
#######

=============================================================================
PHASE 3 — MAUTRIX WHATSAPP BRIDGE
==============================================================================

### Create mautrix-whatsapp container config ###

cd /opt/matrix/whatsapp
curl -o config.yaml https://raw.githubusercontent.com/mautrix/whatsapp/master/example-config.yaml

### SET BRIDGE DOMAIN ###

### before setting Bridge Domain make sure that you have domain and also register an Dns record eg. matrix.youdomain ####

### Create WhatsApp registration file ###

docker run -it --rm \
  -v /opt/matrix/whatsapp:/data \
  dock.mau.dev/mautrix/whatsapp:latest \
  /usr/bin/mautrix-whatsapp \
  --generate-registration

- test -
ls /opt/matrix/whatsapp

- This creates -
config.yaml

nano /opt/matrix/whatsapp/config.yaml

- Find -
homeserver:
  address: http://localhost:8008
  domain:
- set it to -
homeserver:
  address: http://synapse:8008
  domain: matrix.wrexer.com
- Find -
appservice:
  address: http://127.0.0.1:29318
- set it to -
appservice:
  address: http://0.0.0.0:29318
- Also ensure: -
appservice:
  hostname: mautrix-whatsapp
  port: 29318

- save -

### Register WhatsApp with Synapse ###

sudo nano /opt/matrix/synapse/homeserver.yaml

### Under app_service_config_files: add: ###

app_service_config_files:
  - /data/mautrix-whatsapp-registration.yaml

### again Create WhatsApp registration file ###
docker run -it --rm \
  -v /opt/matrix/whatsapp:/data \
  dock.mau.dev/mautrix/whatsapp:latest \
  /usr/bin/mautrix-whatsapp \
  --generate-registration

- test -
ls /opt/matrix/whatsapp

- This creates -
registration.yaml
config.yaml

### Then link it: ###

cp /opt/matrix/whatsapp/registration.yaml /opt/matrix/synapse/mautrix-whatsapp-registration.yaml

- Restart Synapse: -
docker restart synapse

### edit mautrix-whatsapp-registration.yaml ###

sudo nano /opt/matrix/synapse/mautrix-whatsapp-registration.yaml

- find -
url: http://127.0.0.1:29318
- replace with -
url: http://mautrix-whatsapp:29318
- permissions -
sudo chmod 644 /opt/matrix/synapse/mautrix-whatsapp-registration.yaml

- restart synapse -
docker restart synapse

### Create WhatsApp service in compose ###

- Edit /opt/matrix/docker-compose.yml -

- Append: -
  whatsapp:
    image: dock.mau.dev/mautrix/whatsapp:latest
    container_name: mautrix-whatsapp
    restart: unless-stopped
    volumes:
      - ./whatsapp:/data
    depends_on:
      synapse:
        condition: service_started
      whatsapp-db:
        condition: service_healthy
    ports:
      - "29318:29318"
    networks:
      - matrix

### Create named volume ###

docker volume create whatsapp-pgdata

### Add whatsapp-pgdata to compose ###

- add /opt/matrix/docker-compose.yml -
  whatsapp-db:
    image: postgres:15
    container_name: whatsapp-db
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mautrix"]
      interval: 10s
      timeout: 5s
      retries: 5

    environment:
      POSTGRES_DB: mautrix_whatsapp
      POSTGRES_USER: mautrix
      POSTGRES_PASSWORD: set_your_password
    volumes:
      - whatsapp-pgdata:/var/lib/postgresql/data

    networks:
      - matrix

- at bottom of file add -
volumes:
  whatsapp-pgdata:


### Configure mautrix to use DB ###

nano /opt/matrix/whatsapp/config.yaml

- set -
database:
  uri: postgres://mautrix:your_password@whatsapp-db/mautrix_whatsapp?sslmode=disable

### DEFINE BRIDGE ACCESS CONTROL ###

nano /opt/matrix/whatsapp/config.yaml

- Find -
bridge:
  permissions:

- Replace with -
bridge:
  permissions:
    "*": relay
    "@admin:matrix.wrexer.com": admin

- set permissions -
sudo chown -R ubuntu:ubuntu /opt/matrix/whatsapp
sudo mkdir -p /opt/matrix/whatsapp/db
sudo chown -R 999:999 /opt/matrix/whatsapp/db

### Start WhatsApp bridge ###

docker compose up -d

- Validation -
docker ps
docker logs mautrix-whatsapp --tail=50


### Register your first Matrix admin user ###

docker exec -it synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -a \
  http://localhost:8008

- u will be prompted for username,password , confirm password fill it -

### make sure ###

matrix.yourdomain is pointing to servers public ip 

============================================================================
Phase 4 — Public HTTPS Activation
============================================================================

### Install Nginx & Certbot ###

sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

### Expose Synapse to Nginx ###

- Edit your compose file: -
sudo nano /opt/matrix/docker-compose.yml
- Add ports to synapse: -
  synapse:
    ports:
      - "127.0.0.1:8008:8008"
- Apply: -
docker compose up -d

### Nginx reverse proxy ###

- Create config: -
sudo nano /etc/nginx/sites-available/matrix.wrexer.com
- paste this -
server {
    server_name matrix.wrexer.com;

    location / {
        proxy_pass http://127.0.0.1:8008;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}

- Enable: -
sudo ln -s /etc/nginx/sites-available/matrix.wrexer.com /etc/nginx/sites-enabled/
- remove default site  -
sudo rm /etc/nginx/sites-enabled/default
- enable our matrix.yourdomainname - 
sudo ln -s /etc/nginx/sites-available/matrix.wrexer.com /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx

### Issue SSL certificate ###

sudo certbot --nginx -d matrix.wrexer.com

### Test Synapse ### 

https://matrix.yourdomain/_matrix/client/versions


=======================================================================================
Phase 4 – Element Client Onboarding
=======================================================================================

### Open Element Web ### 

https://app.element.io

- set Homeserver -

https://matrix.wrexer.com
- continue -
- Login Using Admin Account we created - 

### click start chat ### 

- search for - 
@whatsappbot:matrix.wrexer.com
- continue -

- sent message - 
login

- import your chats and goups -

!wa sync groups
!wa sync contacts
!wa sync contacts-with-avatars
!wa sync appstate

- 


============================================================================================
Phase 5 MAUTRIX INSTAGRAM BRIDGE  
============================================================================================

### Phase IG-1 — Prepare Instagram workspace ###

mkdir -p /opt/matrix/instagram

- Bootstrap default config -
docker run --rm -v /opt/matrix/instagram:/data dock.mau.dev/mautrix/instagram:latest

- This will create: -
/opt/matrix/instagram/config.yaml

### Normalize Instagram config ###

- Edit: -
nano /opt/matrix/instagram/config.yaml
- Homeserver -
homeserver:
  address: http://synapse:8008
  domain: matrix.wrexer.com
- Appservice -
appservice:
  address: http://mautrix-instagram:29319
  hostname: mautrix-instagram
  port: 29319
  uri: postgres://mautrix:amarnath@instagram-db:5432/mautrix_instagram?sslmode=disable
- Permissions -
  permissions:
    "*": relay
    "matrix.wrexer.com": user
    "@admin:matrix.wrexer.com": admin
- Save exit -

### Generate registration ###

docker run --rm -v /opt/matrix/instagram:/data dock.mau.dev/mautrix/instagram:latest

- You will now have -
/opt/matrix/instagram/registration.yaml

### Create Instagram Postgres volume ###
docker volume create instagram-pgdata

### Extend docker-compose.yml ###

  instagram-db:
    image: postgres:15
    container_name: instagram-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: mautrix_instagram
      POSTGRES_USER: mautrix
      POSTGRES_PASSWORD: amarnath
    healthcheck:
      test: ["CMD-SHELL","pg_isready -U mautrix"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - instagram-pgdata:/var/lib/postgresql/data
    networks:
      - matrix

  mautrix-instagram:
    image: dock.mau.dev/mautrix/instagram:latest
    container_name: mautrix-instagram
    restart: unless-stopped
    volumes:
      - ./instagram:/data
    depends_on:
      synapse:
        condition: service_started
      instagram-db:
        condition: service_healthy
    networks:
      - matrix

### add volume at bottom ###

instagram-pgdata:

### Register bridge in Synapse ###

cp /opt/matrix/instagram/registration.yaml /opt/matrix/synapse/mautrix-instagram-registration.yaml

- Edit: -

nano /opt/matrix/synapse/homeserver.yaml

- Append: -

app_service_config_files:
  - /data/mautrix-whatsapp-registration.yaml
  - /data/mautrix-instagram-registration.yaml

### Create Instagram bot user ###

docker exec -it synapse register_new_matrix_user \
  -c /data/homeserver.yaml \
  -a \
  http://localhost:8008

docker restart mautrix-instagram

==============================================================================
instagram is ready 
==============================================================================