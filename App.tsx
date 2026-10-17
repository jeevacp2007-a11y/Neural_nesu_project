import { useEffect, useState } from 'react';
import AuthPanel from './components/AuthPanel';
import CustomerPortal from './components/CustomerPortal';
import EmployeePortal from './components/EmployeePortal';
import { languageNames, readLanguagePreference, t, writeLanguagePreference } from './lib/i18n';
import { localDemoMode } from './lib/supabase';
import { determinePortalRole, getCurrentPortalSession, signInLocal, signOut, type PortalRole } from './services/auth';
import type { Language, PortalSession } from './types';
import { requireSupabase } from './lib/supabase';
import { LOCAL_EMPLOYEE_EMAIL, LOCAL_EMPLOYEE_PASSWORD } from './services/localDemo';

type Page = 'home' | PortalRole;

export default function App() {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [role, setRole] = useState<PortalRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [language, setLanguage] = useState<Language>(readLanguagePreference);
  const [message, setMessage] = useState<'sessionLoadFailed' | 'roleCheckFailed' | 'signedOutSuccess' | 'signedOutFailed' | ''>('');

  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    getCurrentPortalSession().then((nextSession) => {
      if (alive) setSession(nextSession);
    }).catch(() => {
      if (alive) setMessage('sessionLoadFailed');
    }).finally(() => { if (alive) setAuthLoading(false); });
    if (!localDemoMode) {
      const { data: authListener } = requireSupabase().auth.onAuthStateChange((_event, nextSession) => {
        if (!alive) return;
        setSession(nextSession ? { user: { id: nextSession.user.id, email: nextSession.user.email } } : null);
        setRole(null);
      });
      unsubscribe = () => authListener.subscription.unsubscribe();
    }
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => { writeLanguagePreference(language); }, [language]);

  useEffect(() => {
    let alive = true;
    if (!session?.user) { setRole(null); setRoleLoading(false); return; }
    setRoleLoading(true);
    determinePortalRole(session.user).then((nextRole) => { if (alive) setRole(nextRole); })
      .catch(() => { if (alive) setMessage('roleCheckFailed'); })
      .finally(() => { if (alive) setRoleLoading(false); });
    return () => { alive = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (role && page === 'home') setPage(role);
  }, [role, page]);

  const authenticated = (nextSession: PortalSession, nextRole: PortalRole) => {
    setSession(nextSession); setRole(nextRole); setPage(nextRole); setMessage('');
  };
  const signOutNow = async () => {
    try { await signOut(); setSession(null); setRole(null); setPage('home'); setMessage('signedOutSuccess'); }
    catch { setMessage('signedOutFailed'); }
  };

  const openEmployerDemo = async () => {
    if (!localDemoMode || !session?.user || role !== 'customer') throw new Error('Sign in to a Local Demo Mode customer account before opening the employer demo.');
    const reviewer = await signInLocal(LOCAL_EMPLOYEE_EMAIL, LOCAL_EMPLOYEE_PASSWORD);
    authenticated(reviewer.session, reviewer.role);
  };

  return <div className="app-shell">
    <header className="site-header">
      <button className="brand" onClick={() => setPage('home')} aria-label={`${t(language, 'backToBankFlow')} ${t(language, 'home')}`}><span className="brand-mark">BF</span><span><strong>BankFlow AI</strong><small>{t(language, 'welcome')}</small></span></button>
      <nav className="main-nav" aria-label={t(language, 'mainNavigation')}>
        <button className={page === 'customer' ? 'active' : ''} onClick={() => setPage('customer')}>{t(language, 'customerPortal')}</button>
        <button className={page === 'employee' ? 'active' : ''} onClick={() => setPage('employee')}>{t(language, 'employeePortal')}</button>
      </nav>
      <div className="header-tools">
        <label className="header-language"><span className="visually-hidden">{t(language, 'chooseLanguage')}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t(language, 'chooseLanguage')}>
          {Object.entries(languageNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        {session && <><span className="user-email">{session.user.email}</span><button className="button button-quiet" onClick={() => void signOutNow()}>{t(language, 'logout')}</button></>}
      </div>
    </header>

    {localDemoMode && <aside className="local-mode-banner" role="note"><strong>{t(language, 'localDemoMode')}</strong><span>{t(language, 'localDemoInfo')}</span></aside>}

    {message && <div className="global-message" role="status">{t(language, message)}<button onClick={() => setMessage('')} aria-label={t(language, 'dismiss')}>×</button></div>}

    {authLoading || roleLoading ? <main className="loading-screen"><span className="spinner" />{t(language, 'checkSession')}</main>
      : session && role ? page === role ? role === 'customer'
        ? <CustomerPortal user={session.user} language={language} onLanguageChange={setLanguage} onOpenEmployerDemo={openEmployerDemo} />
        : <EmployeePortal user={session.user} language={language} />
        : <main className="access-notice"><span className="eyebrow">{t(language, 'accessProtected')}</span><h1>{t(language, 'choosePortal')}</h1><p>{t(language, 'wrongPortal', { role: t(language, role === 'customer' ? 'customerPortal' : 'employeePortal') })}</p><div className="button-row"><button className="button button-primary" onClick={() => setPage(role)}>{role === 'customer' ? t(language, 'customerPortal') : t(language, 'employeePortal')}</button><button className="button button-secondary" onClick={() => void signOutNow()}>{t(language, 'switchAccounts')}</button></div></main>
      : session ? <main className="access-notice"><span className="eyebrow">{t(language, 'accessProtected')}</span><h1>{t(language, 'accessNotVerified')}</h1><p>{t(language, 'roleLookupHelp')}</p><button className="button button-secondary" onClick={() => void signOutNow()}>{t(language, 'logout')}</button></main>
      : page === 'home' ? <Landing language={language} onNavigate={setPage} />
        : <main className="auth-page"><button className="text-button" onClick={() => setPage('home')}>← {t(language, 'backToBankFlow')}</button><AuthPanel portal={page} language={language} onAuthenticated={authenticated} /></main>}

    <footer className="site-footer"><div><span className="brand-mark small-mark">BF</span><span>BankFlow AI <small>· {t(language, 'prototype')}</small></span></div><p>{t(language, 'disclaimer')}</p></footer>
  </div>;
}

function Landing({ language, onNavigate }: { language: Language; onNavigate: (page: Page) => void }) {
  return <main className="landing">
    <section className="hero-section">
      <div className="hero-copy"><span className="eyebrow hero-eyebrow"><span className="live-dot" /> {t(language, 'accessibleAssistant')}</span>
        <h1>{t(language, 'welcome')}</h1><p>{t(language, 'description')}</p>
        <div className="hero-actions"><button className="button button-primary button-large" onClick={() => onNavigate('customer')}>{t(language, 'start')} <span>→</span></button><button className="button button-secondary button-large" onClick={() => onNavigate('customer')}>{t(language, 'login')}</button></div>
        <p className="hero-disclaimer">{t(language, 'disclaimer')}</p>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="art-glow"/><div className="art-card main-art-card"><div className="art-card-top"><span className="art-chip"/><span className="art-mark">BF</span></div><small>{t(language, 'applicationJourney')}</small><div className="art-flow"><div className="art-flow-line"/><span className="art-node complete">✓</span><span className="art-node complete">✓</span><span className="art-node active">3</span><span className="art-node">4</span></div><div className="art-labels"><span>{t(language, 'customerDetails')}</span><span>{t(language, 'documentsOcr')}</span><span>{t(language, 'review')}</span><span>{t(language, 'statusTracking')}</span></div><div className="art-info"><span><i className="green-dot"/> {t(language, 'ocrTextReviewed')}</span><strong>{t(language, 'demoApplication')}</strong></div></div><div className="float-bubble voice-bubble">◉ <span>{t(language, 'voiceGuided')}</span></div><div className="float-bubble secure-bubble">⌑ <span>{t(language, 'privateDocuments')}</span></div></div>
    </section>

    {localDemoMode && <div className="setup-strip"><span className="setup-icon">↗</span><div><strong>{t(language, 'localDemoReadyTitle')}</strong><p>{t(language, 'localDemoReadyBody')}</p></div></div>}

    <section className="services-section"><div className="section-title"><div><span className="eyebrow">{t(language, 'startOneWorkflow')}</span><h2>{t(language, 'bankingServices')}</h2></div><span className="section-count">{t(language, 'mvpFocus')}</span></div>
      <div className="service-grid">
        <article className="service-card enabled"><span className="service-icon">▤</span><div><span className="availability">{t(language, 'availabilityAvailable')}</span><h3>{t(language, 'accountServices')}</h3><p>{t(language, 'savingsApplicationDescription')}</p></div><button aria-label={`${t(language, 'start')} - ${t(language, 'savingsAccount')}`} onClick={() => onNavigate('customer')}>→</button></article>
        <article className="service-card muted"><span className="service-icon">▣</span><div><span className="availability coming">{t(language, 'availabilityPlanned')}</span><h3>{t(language, 'kycCustomerInformation')}</h3><p>{t(language, 'otherFormsOutsideMvp')}</p></div><span className="coming-label">{t(language, 'later')}</span></article>
        <article className="service-card muted"><span className="service-icon">◉</span><div><span className="availability coming">{t(language, 'availabilityPlanned')}</span><h3>{t(language, 'loansCredit')}</h3><p>{t(language, 'loansOutsideMvp')}</p></div><span className="coming-label">{t(language, 'later')}</span></article>
        <article className="service-card muted"><span className="service-icon">⌁</span><div><span className="availability coming">{t(language, 'availabilityPlanned')}</span><h3>{t(language, 'otherBankingServices')}</h3><p>{t(language, 'reusableTemplatesDescription')}</p></div><span className="coming-label">{t(language, 'later')}</span></article>
      </div>
    </section>

    <section className="workflow-strip"><div><span className="eyebrow">{t(language, 'sharedApplicationRecord')}</span><h2>{t(language, 'guidedToReview')}</h2></div><div className="workflow-step"><span>01</span><div><strong>{t(language, 'customerPortal')}</strong><small>{t(language, 'answersUploads')}</small></div></div><span className="workflow-arrow">→</span><div className="workflow-step"><span>02</span><div><strong>{t(language, 'ocrStage')}</strong><small>{t(language, 'actualImageText')}</small></div></div><span className="workflow-arrow">→</span><div className="workflow-step"><span>03</span><div><strong>{t(language, 'employeePortal')}</strong><small>{t(language, 'reviewsNotes')}</small></div></div><span className="workflow-arrow">→</span><div className="workflow-step"><span>04</span><div><strong>{t(language, 'customerPortal')}</strong><small>{t(language, 'tracksResubmits')}</small></div></div></section>

    <section className="portal-choices"><div><span className="eyebrow">{t(language, 'choosePortal')}</span><h2>{t(language, 'portalChoicesHeading')}</h2></div><div className="portal-choice-cards"><button onClick={() => onNavigate('customer')}><span className="choice-icon">♙</span><span><strong>{t(language, 'customerPortal')}</strong><small>{t(language, 'startOrTrackApplication')}</small></span><b>→</b></button><button onClick={() => onNavigate('employee')}><span className="choice-icon employee-icon">▥</span><span><strong>{t(language, 'employeePortal')}</strong><small>{t(language, 'reviewSubmittedApplications')}</small></span><b>→</b></button></div></section>
  </main>;
}
