import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { OPTIONAL_DIRECTORY_FIELD_DEFINITIONS, type DirectoryOptionalFieldKey, type MemberDirectoryConfig } from '@/lib/memberDirectory';
import type { MouseEvent } from 'react';

type ChapterOption = {
  id: string;
  number: string | null;
  name: string | null;
  state: string | null;
};

const DENSITY_KEY = 'cma-member-form-dense';

const sectionNav = [
  { id: 'member-identity', label: 'Identity', code: 'ID' },
  { id: 'member-contact', label: 'Contact', code: 'CT' },
  { id: 'member-family', label: 'Family', code: 'FA' },
  { id: 'member-riding', label: 'Membership And Riding', code: 'RD' },
  { id: 'member-ministry', label: 'Ministry Preferences', code: 'MN' },
  { id: 'member-notes', label: 'Notes And Logistics', code: 'NT' },
  { id: 'member-sharing', label: 'Directory Sharing', code: 'DS' }
] as const;

export default function NewMemberPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [sharedConfig, setSharedConfig] = useState<MemberDirectoryConfig>({ optionalFields: [] });
  const [denseMode, setDenseMode] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof sectionNav)[number]['id']>(sectionNav[0].id);
  const [validationErrors, setValidationErrors] = useState<Record<'firstName' | 'lastName' | 'cmaNumber', string>>({
    firstName: '',
    lastName: '',
    cmaNumber: ''
  });
  const [memberData, setMemberData] = useState({
    firstName: '',
    lastName: '',
    cmaNumber: '',
    phone1: '',
    phone2: '',
    hasMotorcycleInsurance: false,
    status: '',
    statusEffectiveDate: '',
    birthday: '',
    anniversary: '',
    emailHome: '',
    emailWork: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    spouseName: '',
    spouseCmaNumber: '',
    spouseCellPhone: '',
    spouseEmail: '',
    childrenNames: '',
    grandchildrenNames: '',
    memberSinceYear: '',
    spouseMemberSinceYear: '',
    yearsInChapter: '',
    spouseYearsInChapter: '',
    milesToMeetings: '',
    yearsRidingSelf: '',
    msfCourseSelf: false,
    yearsRidingSpouse: '',
    msfCourseSpouse: false,
    churchName: '',
    activeInMinistry: false,
    ministryHow: '',
    wantsEventContact: false,
    willingHostBibleStudy: false,
    willingHostFellowship: false,
    willingPrayerLineEmail: false,
    willingRunForSonHelp: false,
    belongsOtherMotoOrg: false,
    holdsOfficeOtherOrgs: false,
    comments: '',
    rescueEquipment: '',
    lodging: '',
    directoryShareHiddenFields: [] as DirectoryOptionalFieldKey[],
    chapterId: ''
  });
  const [error, setError] = useState<string | null>(null);
  const chapterIdFromQuery = typeof router.query.chapterId === 'string' ? router.query.chapterId : '';
  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : '';

  useEffect(() => {
    async function loadSetupData() {
      const [chapterResponse, configResponse] = await Promise.all([
        fetch('/api/chapters'),
        fetch('/api/member-directory/config')
      ]);

      if (chapterResponse.ok) {
        const chapterOptions = (await chapterResponse.json()) as ChapterOption[];
        setChapters(chapterOptions);
        if (chapterIdFromQuery && chapterOptions.some((chapter) => chapter.id === chapterIdFromQuery)) {
          setMemberData((current) => ({ ...current, chapterId: chapterIdFromQuery }));
        }
      }

      if (configResponse.ok) {
        setSharedConfig(await configResponse.json());
      }
    }

    loadSetupData();
  }, [chapterIdFromQuery]);

  useEffect(() => {
    const saved = window.localStorage.getItem(DENSITY_KEY);
    setDenseMode(saved === '1');
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function updateActiveSection() {
      let current: (typeof sectionNav)[number]['id'] = sectionNav[0].id;
      for (const section of sectionNav) {
        const element = document.getElementById(section.id);
        if (!element) {
          continue;
        }
        const top = element.getBoundingClientRect().top;
        if (top <= 160) {
          current = section.id;
        }
      }
      setActiveSection(current);
    }

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  function validateRequiredFields(values: typeof memberData) {
    return {
      firstName: values.firstName.trim() ? '' : 'First Name is required.',
      lastName: values.lastName.trim() ? '' : 'Last Name is required.',
      cmaNumber: values.cmaNumber.trim() ? '' : 'CMA Number is required.'
    };
  }

  function setFieldAndValidate(field: 'firstName' | 'lastName' | 'cmaNumber', value: string) {
    const next = { ...memberData, [field]: value };
    setMemberData(next);
    setValidationErrors((current) => ({ ...current, [field]: validateRequiredFields(next)[field] }));
  }

  function scrollToSectionWithOffset(sectionId: (typeof sectionNav)[number]['id']) {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const topNav = document.querySelector('.app-top-nav');
    const navHeight = topNav ? topNav.getBoundingClientRect().height : 0;
    const extraGap = 12;
    const y = target.getBoundingClientRect().top + window.scrollY - navHeight - extraGap;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }

  function handleSectionNavClick(event: MouseEvent<HTMLElement>, sectionId: (typeof sectionNav)[number]['id']) {
    event.preventDefault();
    setActiveSection(sectionId);
    scrollToSectionWithOffset(sectionId);
  }

  function toggleDenseMode() {
    setDenseMode((current) => {
      const next = !current;
      window.localStorage.setItem(DENSITY_KEY, next ? '1' : '0');
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextErrors = validateRequiredFields(memberData);
    setValidationErrors(nextErrors);
    if (nextErrors.firstName || nextErrors.lastName || nextErrors.cmaNumber) {
      setError('Please complete the required fields in Identity.');
      return;
    }

    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData)
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.message || 'Failed to create member.');
      return;
    }

    const created = await res.json();
    if (returnTo) {
      const separator = returnTo.includes('?') ? '&' : '?';
      router.push(`${returnTo}${separator}memberId=${encodeURIComponent(created.id)}`);
      return;
    }

    router.push(`/members/${created.id}`);
  }

  return (
    <main className="page-shell">
      <h1>Create Member Record</h1>
      <p>Complete the sections below and save when ready.</p>
      {error ? <p className="message-error">{error}</p> : null}

      <div className="member-form-toolbar">
        <button type="button" className="btn-secondary" onClick={toggleDenseMode}>
          {denseMode ? 'Use Standard Spacing' : 'Use Dense Entry Mode'}
        </button>
      </div>

      <div className="member-layout">
      <aside className="section-index card" aria-label="Member form sections">
        <h3>Sections</h3>
        <p className="section-index__meta">Jump directly to each form group.</p>
        <nav className="section-index__nav" aria-label="Jump to section">
          {sectionNav.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`section-index__item${activeSection === section.id ? ' section-index__item--active' : ''}`}
              aria-current={activeSection === section.id ? 'true' : undefined}
              aria-controls={section.id}
              onClick={(event) => handleSectionNavClick(event, section.id)}
            >
              <span className="section-index__label">{section.label}</span>
              <span className="section-index__code">{section.code}</span>
            </button>
          ))}
        </nav>
      </aside>

      <form ref={formRef} onSubmit={handleSubmit} className={`member-form${denseMode ? ' member-form--dense' : ''}`}>
        <section id="member-identity" className="card form-section" data-code="ID">
          <h2>Identity</h2>
          <div className="field-grid">
            <label className={validationErrors.firstName ? 'field-error' : ''}>
              First Name
              <input value={memberData.firstName} onChange={(e) => setFieldAndValidate('firstName', e.target.value)} onBlur={(e) => setFieldAndValidate('firstName', e.target.value)} required />
              {validationErrors.firstName ? <span className="field-error-text">{validationErrors.firstName}</span> : null}
            </label>
            <label className={validationErrors.lastName ? 'field-error' : ''}>
              Last Name
              <input value={memberData.lastName} onChange={(e) => setFieldAndValidate('lastName', e.target.value)} onBlur={(e) => setFieldAndValidate('lastName', e.target.value)} required />
              {validationErrors.lastName ? <span className="field-error-text">{validationErrors.lastName}</span> : null}
            </label>
            <label className={validationErrors.cmaNumber ? 'field-error' : ''}>
              CMA Number
              <input value={memberData.cmaNumber} onChange={(e) => setFieldAndValidate('cmaNumber', e.target.value)} onBlur={(e) => setFieldAndValidate('cmaNumber', e.target.value)} required />
              {validationErrors.cmaNumber ? <span className="field-error-text">{validationErrors.cmaNumber}</span> : null}
            </label>
            <label>
              Chapter
              <select value={memberData.chapterId} onChange={(e) => setMemberData({ ...memberData, chapterId: e.target.value })}>
                <option value="">No chapter</option>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.number ?? chapter.name ?? chapter.id} {chapter.state ? `(${chapter.state})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <input value={memberData.status} onChange={(e) => setMemberData({ ...memberData, status: e.target.value })} />
            </label>
            <label>
              Status Effective Date
              <input type="date" value={memberData.statusEffectiveDate} onChange={(e) => setMemberData({ ...memberData, statusEffectiveDate: e.target.value })} />
            </label>
            <label>
              Birthday
              <input type="date" value={memberData.birthday} onChange={(e) => setMemberData({ ...memberData, birthday: e.target.value })} />
            </label>
            <label>
              Anniversary
              <input type="date" value={memberData.anniversary} onChange={(e) => setMemberData({ ...memberData, anniversary: e.target.value })} />
            </label>
          </div>
          <div className="checkbox-grid" style={{ marginTop: 14 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={memberData.hasMotorcycleInsurance} onChange={(e) => setMemberData({ ...memberData, hasMotorcycleInsurance: e.target.checked })} />
              Has Motorcycle Insurance
            </label>
          </div>
        </section>

        <section id="member-contact" className="card form-section" data-code="CT">
          <h2>Contact</h2>
          <div className="field-grid">
            <label>
              Phone 1
              <input value={memberData.phone1} onChange={(e) => setMemberData({ ...memberData, phone1: e.target.value })} />
            </label>
            <label>
              Phone 2
              <input value={memberData.phone2} onChange={(e) => setMemberData({ ...memberData, phone2: e.target.value })} />
            </label>
            <label>
              Home Email
              <input type="email" value={memberData.emailHome} onChange={(e) => setMemberData({ ...memberData, emailHome: e.target.value })} />
            </label>
            <label>
              Work Email
              <input type="email" value={memberData.emailWork} onChange={(e) => setMemberData({ ...memberData, emailWork: e.target.value })} />
            </label>
            <label>
              Address 1
              <input value={memberData.address1} onChange={(e) => setMemberData({ ...memberData, address1: e.target.value })} />
            </label>
            <label>
              Address 2
              <input value={memberData.address2} onChange={(e) => setMemberData({ ...memberData, address2: e.target.value })} />
            </label>
            <label>
              City
              <input value={memberData.city} onChange={(e) => setMemberData({ ...memberData, city: e.target.value })} />
            </label>
            <label>
              State
              <input value={memberData.state} onChange={(e) => setMemberData({ ...memberData, state: e.target.value })} />
            </label>
            <label>
              ZIP Code
              <input value={memberData.zipCode} onChange={(e) => setMemberData({ ...memberData, zipCode: e.target.value })} />
            </label>
            <label>
              Country
              <input value={memberData.country} onChange={(e) => setMemberData({ ...memberData, country: e.target.value })} />
            </label>
          </div>
        </section>

        <section id="member-family" className="card form-section" data-code="FA">
          <h2>Family</h2>
          <div className="field-grid">
            <label>
              Spouse Name
              <input value={memberData.spouseName} onChange={(e) => setMemberData({ ...memberData, spouseName: e.target.value })} />
            </label>
            <label>
              Spouse CMA Number
              <input value={memberData.spouseCmaNumber} onChange={(e) => setMemberData({ ...memberData, spouseCmaNumber: e.target.value })} />
            </label>
            <label>
              Spouse Cell Phone
              <input value={memberData.spouseCellPhone} onChange={(e) => setMemberData({ ...memberData, spouseCellPhone: e.target.value })} />
            </label>
            <label>
              Spouse Email
              <input type="email" value={memberData.spouseEmail} onChange={(e) => setMemberData({ ...memberData, spouseEmail: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Children Names
              <textarea rows={2} value={memberData.childrenNames} onChange={(e) => setMemberData({ ...memberData, childrenNames: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Grandchildren Names
              <textarea rows={2} value={memberData.grandchildrenNames} onChange={(e) => setMemberData({ ...memberData, grandchildrenNames: e.target.value })} />
            </label>
          </div>
        </section>

        <section id="member-riding" className="card form-section" data-code="RD">
          <h2>Membership And Riding</h2>
          <div className="field-grid">
            <label>
              Member Since Year
              <input value={memberData.memberSinceYear} onChange={(e) => setMemberData({ ...memberData, memberSinceYear: e.target.value })} />
            </label>
            <label>
              Spouse Member Since Year
              <input value={memberData.spouseMemberSinceYear} onChange={(e) => setMemberData({ ...memberData, spouseMemberSinceYear: e.target.value })} />
            </label>
            <label>
              Years in Chapter
              <input value={memberData.yearsInChapter} onChange={(e) => setMemberData({ ...memberData, yearsInChapter: e.target.value })} />
            </label>
            <label>
              Spouse Years in Chapter
              <input value={memberData.spouseYearsInChapter} onChange={(e) => setMemberData({ ...memberData, spouseYearsInChapter: e.target.value })} />
            </label>
            <label>
              Miles to Meetings
              <input value={memberData.milesToMeetings} onChange={(e) => setMemberData({ ...memberData, milesToMeetings: e.target.value })} />
            </label>
            <label>
              Years Riding (Self)
              <input value={memberData.yearsRidingSelf} onChange={(e) => setMemberData({ ...memberData, yearsRidingSelf: e.target.value })} />
            </label>
            <label>
              Years Riding (Spouse)
              <input value={memberData.yearsRidingSpouse} onChange={(e) => setMemberData({ ...memberData, yearsRidingSpouse: e.target.value })} />
            </label>
          </div>
          <div className="checkbox-grid" style={{ marginTop: 14 }}>
            <label className="checkbox-row">
              <input type="checkbox" checked={memberData.msfCourseSelf} onChange={(e) => setMemberData({ ...memberData, msfCourseSelf: e.target.checked })} />
              MSF Course (Self)
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={memberData.msfCourseSpouse} onChange={(e) => setMemberData({ ...memberData, msfCourseSpouse: e.target.checked })} />
              MSF Course (Spouse)
            </label>
          </div>
        </section>

        <section id="member-ministry" className="card form-section" data-code="MN">
          <h2>Ministry Preferences</h2>
          <div className="field-grid">
            <label>
              Church Name
              <input value={memberData.churchName} onChange={(e) => setMemberData({ ...memberData, churchName: e.target.value })} />
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Ministry Details
              <textarea rows={2} value={memberData.ministryHow} onChange={(e) => setMemberData({ ...memberData, ministryHow: e.target.value })} />
            </label>
          </div>
          <div className="checkbox-grid" style={{ marginTop: 14 }}>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.activeInMinistry} onChange={(e) => setMemberData({ ...memberData, activeInMinistry: e.target.checked })} />Active in Ministry</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.wantsEventContact} onChange={(e) => setMemberData({ ...memberData, wantsEventContact: e.target.checked })} />Wants Event Contact</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.willingHostBibleStudy} onChange={(e) => setMemberData({ ...memberData, willingHostBibleStudy: e.target.checked })} />Willing Host Bible Study</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.willingHostFellowship} onChange={(e) => setMemberData({ ...memberData, willingHostFellowship: e.target.checked })} />Willing Host Fellowship</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.willingPrayerLineEmail} onChange={(e) => setMemberData({ ...memberData, willingPrayerLineEmail: e.target.checked })} />Willing Prayer Line Email</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.willingRunForSonHelp} onChange={(e) => setMemberData({ ...memberData, willingRunForSonHelp: e.target.checked })} />Willing Run For Son Help</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.belongsOtherMotoOrg} onChange={(e) => setMemberData({ ...memberData, belongsOtherMotoOrg: e.target.checked })} />Belongs Other Moto Org</label>
            <label className="checkbox-row"><input type="checkbox" checked={memberData.holdsOfficeOtherOrgs} onChange={(e) => setMemberData({ ...memberData, holdsOfficeOtherOrgs: e.target.checked })} />Holds Office Other Orgs</label>
          </div>
        </section>

        <section id="member-notes" className="card form-section" data-code="NT">
          <h2>Notes And Logistics</h2>
          <div className="field-grid">
            <label style={{ gridColumn: '1 / -1' }}>
              Comments
              <textarea rows={3} value={memberData.comments} onChange={(e) => setMemberData({ ...memberData, comments: e.target.value })} />
            </label>
            <label>
              Rescue Equipment
              <textarea rows={2} value={memberData.rescueEquipment} onChange={(e) => setMemberData({ ...memberData, rescueEquipment: e.target.value })} />
            </label>
            <label>
              Lodging
              <textarea rows={2} value={memberData.lodging} onChange={(e) => setMemberData({ ...memberData, lodging: e.target.value })} />
            </label>
          </div>
        </section>

        <section id="member-sharing" className="card form-section" data-code="DS">
          <h2>Directory Sharing</h2>
          <p>Default shared fields are always visible: Name, Street Address, City, State ZIP, Phone1, Phone2.</p>
          {sharedConfig.optionalFields.length === 0 ? <p>Admin has not enabled any optional shared fields.</p> : null}
          <div className="checkbox-grid">
            {OPTIONAL_DIRECTORY_FIELD_DEFINITIONS
              .filter((field) => sharedConfig.optionalFields.includes(field.key))
              .map((field) => (
                <label key={field.key} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={!memberData.directoryShareHiddenFields.includes(field.key)}
                    onChange={(event) => {
                      setMemberData((current) => {
                        const hidden = new Set(current.directoryShareHiddenFields);
                        if (event.target.checked) {
                          hidden.delete(field.key);
                        } else {
                          hidden.add(field.key);
                        }
                        return { ...current, directoryShareHiddenFields: Array.from(hidden) };
                      });
                    }}
                  />
                  Share {field.label}
                </label>
              ))}
          </div>
        </section>

        <div className="form-actions">
          <Link href="/members" className="btn-secondary">Cancel</Link>
          <button type="submit">Create Member</button>
        </div>
      </form>
      </div>
    </main>
  );
}
