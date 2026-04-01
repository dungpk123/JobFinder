import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import './OnlineCvBuilder.css';

const allTemplates = [
  {
    id: 1,
    name: 'Tiêu chuẩn',
    tags: ['Đơn giản'],
    accent: 'accent-one'
  },
  {
    id: 2,
    name: 'Tiêu chuẩn (ít kinh nghiệm)',
    tags: ['Đơn giản', 'Chuyên nghiệp'],
    accent: 'accent-two'
  },
  {
    id: 3,
    name: 'Ấn tượng 6',
    tags: ['Hiện đại', 'Chuyên nghiệp'],
    accent: 'accent-three'
  },
  {
    id: 4,
    name: 'Ấn tượng 2',
    tags: ['Chuyên nghiệp'],
    accent: 'accent-four'
  },
  {
    id: 5,
    name: 'Thành lịch',
    tags: ['Đơn giản', 'Hiện đại'],
    accent: 'accent-five'
  },
  {
    id: 6,
    name: 'Tham vọng',
    tags: ['Chuyên nghiệp', 'Ấn tượng'],
    accent: 'accent-six'
  },
  {
    id: 7,
    name: 'Sáng tạo',
    tags: ['Hiện đại', 'Ấn tượng'],
    accent: 'accent-seven'
  },
  {
    id: 8,
    name: 'Tối giản',
    tags: ['Đơn giản', 'Hiện đại'],
    accent: 'accent-eight'
  },
  {
    id: 9,
    name: 'Chuyên gia',
    tags: ['Chuyên nghiệp', 'Ấn tượng'],
    accent: 'accent-nine'
  },
  {
    id: 10,
    name: 'Năng động',
    tags: ['Hiện đại', 'Ấn tượng'],
    accent: 'accent-ten'
  },
  {
    id: 11,
    name: 'Thanh lịch',
    tags: ['Chuyên nghiệp', 'Đơn giản'],
    accent: 'accent-eleven'
  },
  {
    id: 12,
    name: 'Hiện đại Plus',
    tags: ['Hiện đại', 'Chuyên nghiệp'],
    accent: 'accent-twelve'
  }
];

const categories = [
  { key: 'Tất cả', label: 'Tất cả', icon: 'bi-grid' },
  { key: 'Đơn giản', label: 'Đơn giản', icon: 'bi-circle' },
  { key: 'Chuyên nghiệp', label: 'Chuyên nghiệp', icon: 'bi-briefcase' },
  { key: 'Hiện đại', label: 'Hiện đại', icon: 'bi-stars' },
  { key: 'Ấn tượng', label: 'Ấn tượng', icon: 'bi-lightning-charge' }
];

const OnlineCvBuilder = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  const filteredTemplates = useMemo(() => {
    if (activeCategory === 'Tất cả') return allTemplates;
    return allTemplates.filter(template => template.tags.includes(activeCategory));
  }, [activeCategory]);

  const handleSelectTemplate = (template) => {
    navigate(`/create-cv/online-editor?template=${encodeURIComponent(template.accent || 'accent-one')}`);
    notify({ type: 'info', title: 'Khởi tạo CV', message: `Bạn đang dùng mẫu: ${template.name}` });
  };

  // Render template preview based on layout type
  const renderTemplatePreview = (template) => {
    const accentKey = template.accent || 'accent-one';
    
    // Get color scheme for each template
    const getColors = () => {
      switch (accentKey) {
        case 'accent-one': return { sidebar: '#2f6f7a', accent: '#2f6f7a' };
        case 'accent-two': return { sidebar: '#1e3a8a', accent: '#1d4ed8' };
        case 'accent-three': return { sidebar: '#14532d', accent: '#15803d' };
        case 'accent-four': return { sidebar: '#4c1d95', accent: '#6d28d9' };
        case 'accent-five': return { sidebar: '#991b1b', accent: '#dc2626' };
        case 'accent-six': return { sidebar: '#c2410c', accent: '#ea580c' };
        case 'accent-seven': return { sidebar: '#0e7490', accent: '#0891b2' };
        case 'accent-eight': return { sidebar: '#3730a3', accent: '#4f46e5' };
        case 'accent-nine': return { sidebar: '#047857', accent: '#059669' };
        case 'accent-ten': return { sidebar: '#9f1239', accent: '#db2777' };
        case 'accent-eleven': return { sidebar: '#5b21b6', accent: '#7c3aed' };
        case 'accent-twelve': return { sidebar: '#115e59', accent: '#0d9488' };
        default: return { sidebar: '#2f6f7a', accent: '#2f6f7a' };
      }
    };
    
    const colors = getColors();
    
    // Template 1: Classic sidebar left
    if (accentKey === 'accent-one') {
      return (
        <div className="cv-preview-layout cv-preview-detailed">
          <div className="cv-preview-sidebar" style={{background: colors.sidebar}}>
            <div className="cv-preview-avatar"></div>
            <div className="cv-preview-text-white">Liên hệ</div>
            <div className="cv-preview-text-small">📞 0987654321</div>
            <div className="cv-preview-text-small">✉ email@example.com</div>
            <div className="cv-preview-divider-white"></div>
            <div className="cv-preview-text-white">Kỹ năng</div>
            <div className="cv-preview-text-small">• Communication</div>
            <div className="cv-preview-text-small">• Teamwork</div>
          </div>
          <div className="cv-preview-main">
            <div className="cv-preview-text-name" style={{color: colors.accent}}>Nguyễn Văn A</div>
            <div className="cv-preview-text-title">Marketing Executive</div>
            <div className="cv-preview-text-section">Kinh nghiệm</div>
            <div className="cv-preview-text-content">ABC Company • 2020-2023</div>
            <div className="cv-preview-text-section">Học vấn</div>
            <div className="cv-preview-text-content">ĐH Kinh tế • 2016-2020</div>
          </div>
        </div>
      );
    }
    
    // Template 2: Classic with color bars
    if (accentKey === 'accent-two') {
      return (
        <div className="cv-preview-layout cv-preview-detailed">
          <div className="cv-preview-sidebar" style={{background: colors.sidebar}}>
            <div className="cv-preview-avatar"></div>
            <div className="cv-preview-text-white">Thông tin</div>
            <div className="cv-preview-text-small">📍 TP.HCM</div>
            <div className="cv-preview-text-small">📧 contact@mail.com</div>
            <div className="cv-preview-divider-white"></div>
            <div className="cv-preview-text-white">Ngôn ngữ</div>
            <div className="cv-preview-text-small">Tiếng Anh: Tốt</div>
            <div className="cv-preview-text-small">Tiếng Việt: Bản ngữ</div>
          </div>
          <div className="cv-preview-main">
            <div className="cv-preview-text-name" style={{color: colors.accent}}>Trần Thị B</div>
            <div className="cv-preview-text-title">Business Analyst</div>
            <div className="cv-preview-section-bar" style={{background: colors.accent}}></div>
            <div className="cv-preview-text-section">Kinh nghiệm làm việc</div>
            <div className="cv-preview-text-content">Senior Analyst • XYZ Corp</div>
            <div className="cv-preview-text-content">2021 - Hiện tại</div>
          </div>
        </div>
      );
    }
    
    // Template 3: Two-column equal
    if (accentKey === 'accent-three') {
      return (
        <div className="cv-preview-layout cv-preview-detailed cv-preview-two-col">
          <div className="cv-preview-col-left">
            <div className="cv-preview-avatar-large"></div>
            <div className="cv-preview-text-name" style={{color: colors.accent}}>Lê Văn C</div>
            <div className="cv-preview-text-title">Software Developer</div>
            <div className="cv-preview-text-section">Giới thiệu</div>
            <div className="cv-preview-text-content-multi">
              <div className="cv-preview-line-text"></div>
              <div className="cv-preview-line-text short"></div>
            </div>
          </div>
          <div className="cv-preview-col-right">
            <div className="cv-preview-text-section" style={{color: colors.accent}}>Kinh nghiệm</div>
            <div className="cv-preview-text-content">Tech Lead • ABC Tech</div>
            <div className="cv-preview-text-content-multi">
              <div className="cv-preview-line-text"></div>
            </div>
            <div className="cv-preview-text-section" style={{color: colors.accent}}>Kỹ năng</div>
            <div className="cv-preview-text-content">React, Node.js, Python</div>
          </div>
        </div>
      );
    }
    
    // Template 4: Creative header
    if (accentKey === 'accent-four') {
      return (
        <div className="cv-preview-layout cv-preview-detailed cv-preview-creative">
          <div className="cv-preview-header-color" style={{background: colors.accent}}>
            <div className="cv-preview-avatar-round-white"></div>
            <div className="cv-preview-text-white-large">Phạm Thị D</div>
            <div className="cv-preview-text-white-small">UX/UI Designer</div>
          </div>
          <div className="cv-preview-content-two-col">
            <div className="cv-preview-col-left">
              <div className="cv-preview-text-section" style={{color: colors.accent}}>Profile</div>
              <div className="cv-preview-text-content-multi">
                <div className="cv-preview-line-text"></div>
                <div className="cv-preview-line-text"></div>
              </div>
              <div className="cv-preview-text-section" style={{color: colors.accent}}>Skills</div>
              <div className="cv-preview-text-content">Figma • Sketch • Adobe XD</div>
            </div>
            <div className="cv-preview-col-right">
              <div className="cv-preview-text-section" style={{color: colors.accent}}>Experience</div>
              <div className="cv-preview-text-content">Senior Designer</div>
              <div className="cv-preview-text-content-multi">
                <div className="cv-preview-line-text"></div>
              </div>
              <div className="cv-preview-text-section" style={{color: colors.accent}}>Education</div>
              <div className="cv-preview-text-content">Design Academy</div>
            </div>
          </div>
        </div>
      );
    }
    
    // Template 5: Minimal elegant
    if (accentKey === 'accent-five') {
      return (
        <div className="cv-preview-layout cv-preview-detailed cv-preview-minimal">
          <div className="cv-preview-header-minimal">
            <div className="cv-preview-text-name-large" style={{color: colors.accent}}>HOÀNG VĂN E</div>
            <div className="cv-preview-text-title">Product Manager</div>
            <div className="cv-preview-contact-row">
              <span>📱 0912345678</span>
              <span>✉ hoang.e@email.com</span>
              <span>📍 Hà Nội</span>
            </div>
          </div>
          <div className="cv-preview-divider-accent" style={{background: colors.accent}}></div>
          <div className="cv-preview-content-single">
            <div className="cv-preview-text-section-minimal" style={{borderColor: colors.accent}}>EXPERIENCE</div>
            <div className="cv-preview-text-content">Product Manager • Tech Corp • 2020-2023</div>
            <div className="cv-preview-text-section-minimal" style={{borderColor: colors.accent}}>EDUCATION</div>
            <div className="cv-preview-text-content">MBA • Business School • 2018-2020</div>
          </div>
        </div>
      );
    }
    
    // Template 6: Modern blocks
    if (accentKey === 'accent-six') {
      return (
        <div className="cv-preview-layout cv-preview-detailed cv-preview-blocks">
          <div className="cv-preview-header-blocks">
            <div className="cv-preview-avatar-square"></div>
            <div className="cv-preview-header-text">
              <div className="cv-preview-text-name" style={{color: colors.accent}}>Vũ Thị F</div>
              <div className="cv-preview-text-title">Content Writer</div>
              <div className="cv-preview-text-contact">📧 vu.f@email.com | 📱 0909123456</div>
            </div>
          </div>
          <div className="cv-preview-content-blocks">
            <div className="cv-preview-block-section" style={{borderLeftColor: colors.accent}}>
              <div className="cv-preview-text-section">ABOUT ME</div>
              <div className="cv-preview-text-content-multi">
                <div className="cv-preview-line-text"></div>
                <div className="cv-preview-line-text short"></div>
              </div>
            </div>
            <div className="cv-preview-block-section" style={{borderLeftColor: colors.accent}}>
              <div className="cv-preview-text-section">EXPERIENCE</div>
              <div className="cv-preview-text-content">Content Lead • Media Co.</div>
            </div>
          </div>
        </div>
      );
    }
    
    // Modern creative layout (7-8)
    if (['accent-seven', 'accent-eight'].includes(accentKey)) {
      return (
        <div className="cv-preview-layout cv-preview-detailed modern">
          <div className="cv-preview-header" style={{background: colors.accent}}>
            <div className="cv-preview-avatar-round"></div>
            <div className="cv-preview-text-white-large">Nguyễn Minh G</div>
            <div className="cv-preview-text-white-small">Data Analyst</div>
            <div className="cv-preview-contact-inline">
              <span>📧 email@test.com</span>
              <span>📱 0987654321</span>
            </div>
          </div>
          <div className="cv-preview-content">
            <div className="cv-preview-text-section" style={{color: colors.accent}}>Professional Summary</div>
            <div className="cv-preview-text-content-multi">
              <div className="cv-preview-line-text"></div>
              <div className="cv-preview-line-text"></div>
            </div>
            <div className="cv-preview-text-section" style={{color: colors.accent}}>Work Experience</div>
            <div className="cv-preview-text-content">Data Analyst • XYZ Analytics</div>
          </div>
        </div>
      );
    }
    
    // Professional two-column layout (9-10)
    if (['accent-nine', 'accent-ten'].includes(accentKey)) {
      return (
        <div className="cv-preview-layout cv-preview-detailed professional">
          <div className="cv-preview-main-left">
            <div className="cv-preview-text-name" style={{color: colors.accent}}>Trần Văn H</div>
            <div className="cv-preview-text-title">Project Manager</div>
            <div className="cv-preview-text-section" style={{color: colors.accent}}>Profile</div>
            <div className="cv-preview-text-content-multi">
              <div className="cv-preview-line-text"></div>
              <div className="cv-preview-line-text short"></div>
            </div>
            <div className="cv-preview-text-section" style={{color: colors.accent}}>Experience</div>
            <div className="cv-preview-text-content">PM • Tech Solutions</div>
          </div>
          <div className="cv-preview-sidebar-right" style={{background: colors.sidebar}}>
            <div className="cv-preview-avatar-round"></div>
            <div className="cv-preview-text-white">Contact</div>
            <div className="cv-preview-text-small">📱 0912345678</div>
            <div className="cv-preview-text-small">✉ tran.h@mail.com</div>
            <div className="cv-preview-divider-white"></div>
            <div className="cv-preview-text-white">Skills</div>
            <div className="cv-preview-text-small">Agile • Scrum</div>
          </div>
        </div>
      );
    }
    
    // Minimalist layout (11-12)
    if (['accent-eleven', 'accent-twelve'].includes(accentKey)) {
      return (
        <div className="cv-preview-layout cv-preview-detailed minimalist">
          <div className="cv-preview-header-min">
            <div className="cv-preview-text-name-center" style={{color: colors.accent}}>Lê Thị I</div>
            <div className="cv-preview-text-title-center">HR Manager</div>
            <div className="cv-preview-contact-center">
              <span>le.i@company.com</span>
              <span>|</span>
              <span>0909876543</span>
              <span>|</span>
              <span>TP.HCM</span>
            </div>
          </div>
          <div className="cv-preview-divider" style={{background: colors.accent}}></div>
          <div className="cv-preview-content">
            <div className="cv-preview-text-section-center" style={{color: colors.accent}}>PROFESSIONAL EXPERIENCE</div>
            <div className="cv-preview-text-content">HR Manager • Global Corp • 2019-Present</div>
            <div className="cv-preview-text-section-center" style={{color: colors.accent}}>EDUCATION</div>
            <div className="cv-preview-text-content">Bachelor of HR Management</div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="cv-templates-page">
      <div className="cv-templates-container">
        <nav className="cv-breadcrumb" aria-label="breadcrumb">
          <ol>
            <li><Link to="/">Trang chủ</Link></li>
            <li aria-current="page">Mẫu CV</li>
          </ol>
        </nav>

        <header className="cv-header">
          <h1>Mẫu xin việc chuẩn 2025</h1>
          <p>
            Tuyển chọn {Math.max(filteredTemplates.length, 6)} mẫu CV đa dạng phong cách, giúp bạn tạo dấu ấn cá nhân
            và kết nối mạnh mẽ hơn với nhà tuyển dụng.
          </p>
        </header>

        <section className="cv-filter-bar">
          <div className="cv-filter-left">
            <span className="cv-filter-label">Lọc theo chủ đề:</span>
            <div className="cv-chips">
              {categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`cv-chip ${activeCategory === category.key ? 'active' : ''}`}
                  onClick={() => setActiveCategory(category.key)}
                >
                  <i className={`bi ${category.icon}`}></i>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="cv-template-grid">
          {filteredTemplates.map((template) => (
            <article key={template.id} className="cv-template-card">
              <div className="cv-template-preview">
                <div className="cv-template-preview-top">
                  <span className="cv-template-badge">Mới</span>
                </div>
                <div className="cv-template-preview-paper">
                  {renderTemplatePreview(template)}
                </div>

                <button
                  type="button"
                  className="cv-template-use"
                  onClick={() => handleSelectTemplate(template)}
                >
                  Dùng mẫu
                </button>
              </div>

              <div className="cv-template-palette">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>

              <div className="cv-template-name">{template.name}</div>
              <div className="cv-template-tags">
                {template.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
};

export default OnlineCvBuilder;

