import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HeroSlideshow } from '../components/HeroSlideshow';
import {
  School,
  LogIn,
  UserPlus,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  Users,
  GraduationCap,
  Award,
  Facebook,
  Instagram,
  Twitter
} from 'lucide-react';

interface Slide {
  id: string;
  title: string | null;
  description: string | null;
  image_url: string;
  order_index: number;
}

interface SchoolConfig {
  school_name: string;
  academic_year: string;
  school_logo: string;
  school_motto: string;
  school_description: string;
  school_address: string;
  school_phone: string;
  school_email: string;
  school_website: string;
  social_facebook: string;
  social_instagram: string;
  social_twitter: string;
  show_statistics: boolean;
  stat_students: string;
  stat_teachers: string;
  stat_graduation: string;
}

export const Landing: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [config, setConfig] = useState<SchoolConfig>({
    school_name: 'SMA Negeri 1 Jakarta',
    academic_year: '2024/2025',
    school_logo: '',
    school_motto: '',
    school_description: '',
    school_address: '',
    school_phone: '',
    school_email: '',
    school_website: '',
    social_facebook: '',
    social_instagram: '',
    social_twitter: '',
    show_statistics: true,
    stat_students: '1000+',
    stat_teachers: '50+',
    stat_graduation: '95%'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [slidesResult, configResult] = await Promise.all([
        supabase
          .from('slideshow_images')
          .select('*')
          .eq('is_active', true)
          .order('order_index', { ascending: true }),
        supabase
          .from('app_config')
          .select('*')
          .in('key', [
            'school_name',
            'academic_year',
            'school_logo',
            'school_motto',
            'school_description',
            'school_address',
            'school_phone',
            'school_email',
            'school_website',
            'social_facebook',
            'social_instagram',
            'social_twitter',
            'show_statistics',
            'stat_students',
            'stat_teachers',
            'stat_graduation'
          ])
      ]);

      if (slidesResult.data) {
        setSlides(slidesResult.data);
      }

      if (configResult.data) {
        const configMap: any = {};
        configResult.data.forEach((item) => {
          configMap[item.key] = item.value;
        });
        setConfig((prev) => ({ ...prev, ...configMap }));
      }
    } catch (error) {
      console.error('Error fetching landing page data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <HeroSlideshow slides={slides}>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12">
              {config.school_logo ? (
                <img
                  src={config.school_logo}
                  alt="Logo Sekolah"
                  className="h-24 md:h-32 mx-auto mb-6 object-contain"
                />
              ) : (
                <div className="h-24 md:h-32 w-24 md:w-32 mx-auto mb-6 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <School className="h-16 md:h-20 w-16 md:w-20 text-white" />
                </div>
              )}

              <h1 className="text-3xl md:text-5xl font-bold text-slate-800 mb-3">
                SPMB {config.school_name}
              </h1>
              <p className="text-xl md:text-2xl text-slate-600 mb-8">
                Tahun Pelajaran {config.academic_year}
              </p>

              {config.school_motto && (
                <p className="text-lg text-slate-700 italic mb-8 max-w-2xl mx-auto">
                  "{config.school_motto}"
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl"
                >
                  <LogIn className="h-5 w-5" />
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-blue-600 font-semibold px-8 py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl border-2 border-blue-600"
                >
                  <UserPlus className="h-5 w-5" />
                  Daftar Sekarang
                </Link>
              </div>
            </div>
          </div>
        </div>
      </HeroSlideshow>

      {config.school_description && (
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex justify-center mb-6">
                {config.school_logo ? (
                  <img
                    src={config.school_logo}
                    alt="Logo"
                    className="h-20 object-contain"
                  />
                ) : (
                  <School className="h-20 w-20 text-blue-600" />
                )}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
                {config.school_name}
              </h2>
              {config.school_motto && (
                <p className="text-xl text-blue-600 font-medium mb-6">
                  {config.school_motto}
                </p>
              )}
              <p className="text-lg text-slate-600 leading-relaxed">
                {config.school_description}
              </p>
            </div>
          </div>
        </section>
      )}

      {config.show_statistics && (
        <section className="py-16 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <Users className="h-12 w-12" />
                </div>
                <div className="text-4xl font-bold mb-2">{config.stat_students}</div>
                <div className="text-blue-100">Siswa Terdaftar</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <GraduationCap className="h-12 w-12" />
                </div>
                <div className="text-4xl font-bold mb-2">{config.stat_teachers}</div>
                <div className="text-blue-100">Guru Berpengalaman</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <Award className="h-12 w-12" />
                </div>
                <div className="text-4xl font-bold mb-2">{config.stat_graduation}</div>
                <div className="text-blue-100">Tingkat Kelulusan</div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 text-center mb-12">
              Cara Pendaftaran Online
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  number: '1',
                  title: 'Daftar Akun',
                  description: 'Buat akun dengan menggunakan email aktif Anda'
                },
                {
                  number: '2',
                  title: 'Isi Formulir',
                  description: 'Lengkapi data pendaftaran dengan informasi yang benar'
                },
                {
                  number: '3',
                  title: 'Upload Dokumen',
                  description: 'Unggah berkas persyaratan yang dibutuhkan'
                },
                {
                  number: '4',
                  title: 'Tunggu Verifikasi',
                  description: 'Admin akan memverifikasi dan memberikan keputusan'
                }
              ].map((step) => (
                <div key={step.number} className="flex gap-4 bg-white p-6 rounded-xl shadow-md">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                      {step.number}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{step.title}</h3>
                    <p className="text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {config.school_logo ? (
                  <img src={config.school_logo} alt="Logo" className="h-12 object-contain" />
                ) : (
                  <School className="h-12 w-12" />
                )}
                <div>
                  <div className="font-bold text-lg">{config.school_name}</div>
                  <div className="text-sm text-slate-400">SPMB {config.academic_year}</div>
                </div>
              </div>
              {config.school_motto && (
                <p className="text-slate-400 text-sm">{config.school_motto}</p>
              )}
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Kontak</h3>
              <div className="space-y-3 text-sm">
                {config.school_address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                    <span className="text-slate-400">{config.school_address}</span>
                  </div>
                )}
                {config.school_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span className="text-slate-400">{config.school_phone}</span>
                  </div>
                )}
                {config.school_email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span className="text-slate-400">{config.school_email}</span>
                  </div>
                )}
                {config.school_website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <a
                      href={config.school_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {config.school_website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-4">Tautan</h3>
              <div className="space-y-2 text-sm mb-6">
                <Link to="/login" className="block text-slate-400 hover:text-white transition-colors">
                  Login
                </Link>
                <Link to="/register" className="block text-slate-400 hover:text-white transition-colors">
                  Daftar
                </Link>
              </div>

              {(config.social_facebook || config.social_instagram || config.social_twitter) && (
                <>
                  <h3 className="font-bold text-lg mb-4">Media Sosial</h3>
                  <div className="flex gap-4">
                    {config.social_facebook && (
                      <a
                        href={config.social_facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <Facebook className="h-6 w-6" />
                      </a>
                    )}
                    {config.social_instagram && (
                      <a
                        href={config.social_instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <Instagram className="h-6 w-6" />
                      </a>
                    )}
                    {config.social_twitter && (
                      <a
                        href={config.social_twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        <Twitter className="h-6 w-6" />
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 text-center text-sm text-slate-400">
            <p>© {new Date().getFullYear()} {config.school_name}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
