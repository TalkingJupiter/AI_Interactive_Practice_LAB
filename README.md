Follow this steps:
1. To download the repo: `git clone git@github.com:TalkingJupiter/AI_Interactive_Practice_LAB.git`
2. Create env file: `cd ai-pracice-lab` and create a new file called `.env.local` 
3. Paste the env variables thats mentioned in Teams Chat
4. To setup and download the reqs use 
    - For macs:
    1. `cd ..`(go the the root where the .sh file lives)
    2. `chmod +x dev_up_mac.sh`
    3. `./dev_up_mac.sh`
    4. The env is ready to use if you see this in terminal:
    ```
    ▲ Next.js 16.1.6 (Turbopack)
    - Local:         http://localhost:3000
    - Network:       http://192.168.50.36:3000
    - Environments: .env.local
    ```
    - For win:
    1. `cd ..`(go the the root where the .ps1 file lives)
    2. In powershell use: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
    3. run the file: `.\dev_up.ps1`