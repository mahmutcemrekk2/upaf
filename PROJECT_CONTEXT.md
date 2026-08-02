# UPAF (Universal Playwright AI Framework) - Project Context

## 🎯 Mission
Build a "Test Automation as a Service" (TaaS) platform. Users design UI/API tests on a visual cloud dashboard, and the platform acts as a Code Generator, transforming these designs into **Playwright + TypeScript (POM)** code pushed directly to the customer's CI/CD repository.

## 🚀 Core Tech Stack
- **Dashboard:** React + Tailwind (Premium Glassmorphism UI)
- **Backend/Auth:** Supabase
- **Code Generator Engine:** Node.js + TypeScript (JSON to Playwright Compiler)
- **AI Integration:** AI-driven locator healing and test step generation.

## 🏗️ System Architecture
```mermaid
graph TD
    A[UPAF Dashboard (React)] -->|Saves Test Steps (JSON)| B[(Supabase Database)]
    B -->|Triggers| C{UPAF Generator Engine}
    C -->|Generates .spec.ts & POM| D[Customer GitHub / GitLab Repo]
    D -->|Executes Tests| E[Customer CI/CD Pipeline]
```

## 🏗️ Automation Types & Models
1. **API Standard:** Standard API testing (requests/responses).
2. **UI Automation:**
    - **Standard UI:** Pure browser interactions.
    - **Hybrid (API + UI):** UI interactions combined with network interception/validation.
3. **Visual Testing:** Pixel-perfect snapshot comparison and design verification.

## 📝 TODO (Future Enhancements)
- **Performance Tracing:** Detailed analysis of page load times and resource bottlenecks.
- **Self-Healing (AI):** Automated locator recovery using AI to prevent test failures.

## 📐 General Rules
- **Code Generator Architecture:** UPAF is a "Code Generator", not a cloud runner. Generated tests are pushed one-way to GitHub/GitLab into an isolated `upaf-generated` directory.
- **Architecture:** Monorepo (Single Repo, Multi-package). All sub-services (`dashboard`, `generator`, `runner`) live in the same repository but are logically separated. This maximizes code sharing and development speed.
- **Strict POM:** All page interactions must be auto-encapsulated in Page classes.
- **Generic First:** Code should be generic enough to adapt to various domains.

## 📍 Current Status (May 2026)
- **Design:** Maintained the high-fidelity "Neon Blue & Glassmorphism" aesthetic.
- **Auth:** Full Supabase Auth integration with "Work Email" validation.
- **Generator Module:** `upaf/generator` engine implemented. Successfully compiles JSON test definitions into Playwright `.spec.ts` and POM classes within `tests/upaf-generated/`.
- **Dashboard Interfaces:**
### Progress
- [x] **Dashboard UI:** Professional 3-column IDE and Project Dashboard.
- [x] **Supabase Integration:** Real-time persistence for Projects, Test Cases, and Steps.
- [x] **Auto-save Logic:** Debounced cloud sync for test steps (1s delay).
- [x] **Dynamic API Testing:** GET, POST, and Status validation support.
- [x] **Environment & Variable System:** Project-level global headers and variables support (Staging/Prod switching).
- [x] **Live Runner (Quick Run):** Real-time API execution within the dashboard with a live terminal output.
- [x] **Generator Engine:** Core `upaf/generator` for Spec/POM production.
- [x] **Git Integration:** Automated push to GitHub/GitLab.
- [ ] **Visual Testing:** Image comparison and viewport regression.

## 🗺️ Roadmap
1. **Phase 1:** Dashboard, Generator, and Live Runner Skeleton ✅ (Complete).
2. **Phase 2:** Database Integration: Link Test Builder's LocalStorage states to Supabase `projects` and `test_steps` tables ✅ (Complete).
3. **Phase 3:** Git Integration: Automate Push/PR deliveries to customer repositories ✅ (Complete).
4. **Phase 4:** Monetization: Handle `is_free` restrictions and subscriptions.
5. **Phase 5:** Intelligence: Visual Testing AI and Locator Self-Healing.
