'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  Layout,
  User,
  AlignLeft,
  Loader2,
  Trash2,
  PenTool,
} from 'lucide-react';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params?.id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    author: '',
    categoryId: '',
    status: 'DRAFT',
    featuredImage: '',
  });

  // --- CARGA DE DADOS ---
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [catsRes, postRes] = await Promise.all([
          api.get('/categories'),
          api.get(`/posts/id/${postId}`),
        ]);

        setCategories(catsRes.data);
        const post = postRes.data;

        setFormData({
          title: post.title || '',
          slug: post.slug || '',
          excerpt: post.excerpt || '',
          content: post.content || '',
          author: post.author || '',
          categoryId: post.category?.id || '',
          status: post.status || 'DRAFT',
          featuredImage: post.featuredImage || '',
        });
      } catch (error) {
        console.error('Erro ao carregar dados', error);
        router.push('/main/posts');
      } finally {
        setIsLoading(false);
      }
    }

    if (postId) {
      loadData();
    }
  }, [postId, router]);

  // --- SALVAR ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.categoryId) {
      alert('Título e Categoria são obrigatórios!');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.put(`/posts/${postId}`, {
        ...formData,
        categoryId: Number(formData.categoryId),
      });
      router.push('/main/posts');
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(error.response?.data?.error || 'Erro ao atualizar post');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground p-6 overflow-y-auto scrollbar-thin">
      {/* --- HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-3">
          <Link href="/main/posts">
            <button className="p-2 hover:bg-muted rounded-xl transition-colors">
              <ArrowLeft className="text-muted-foreground w-5 h-5" />
            </button>
          </Link>
          <div className="bg-primary/10 p-3 rounded-xl">
            <PenTool className="text-primary w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editar Artigo</h1>
            <p className="text-sm text-muted-foreground">
              Atualize as informações e conteúdo
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors"
            onClick={() => {
              if (confirm('Deletar esse post permanentemente?')) {
                api
                  .delete(`/posts/${postId}`)
                  .then(() => router.push('/main/posts'));
              }
            }}
          >
            <Trash2 size={16} /> Excluir
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-all shadow-sm text-sm"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Salvar Alterações
          </button>
        </div>
      </header>

      {/* --- GRID DE CONTEÚDO --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Conteúdo Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Título */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Título do Artigo
              </label>
              <Input
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="text-lg font-medium h-12 border-border bg-background focus:ring-primary/20"
                placeholder="Digite um título atraente..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Slug (URL)
              </label>
              <div className="flex items-center gap-2 bg-muted/30 px-3 rounded-lg border border-border">
                <span className="text-muted-foreground text-xs whitespace-nowrap font-mono">
                  /blog/
                </span>
                <input
                  className="flex-1 bg-transparent border-none text-sm h-9 focus:outline-none text-foreground font-mono"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Card: Conteúdo */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                <AlignLeft className="w-4 h-4" /> Corpo do Texto (Markdown)
              </label>
            </div>
            <textarea
              className="w-full flex-1 p-4 rounded-xl border border-border bg-muted/5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-sm leading-relaxed"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="# Comece a escrever aqui..."
            />
          </div>

          {/* Card: Resumo */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Resumo / Excerpt
            </label>
            <textarea
              className="w-full h-24 p-4 rounded-xl border border-border bg-muted/5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
              value={formData.excerpt}
              onChange={(e) =>
                setFormData({ ...formData, excerpt: e.target.value })
              }
              maxLength={160}
            />
            <div className="text-right text-[10px] text-muted-foreground">
              {formData.excerpt.length}/160 caracteres
            </div>
          </div>
        </div>

        {/* Coluna Direita: Configurações */}
        <div className="space-y-6">
          {/* Card: Status & Categoria */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 border-b border-border pb-4">
              <Layout className="w-4 h-4 text-primary" /> Configurações
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Status
              </label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
                <option value="DRAFT">Rascunho</option>
                <option value="PUBLISHED">Publicado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Categoria
              </label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={formData.categoryId}
                onChange={(e) =>
                  setFormData({ ...formData, categoryId: e.target.value })
                }
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card: Autor */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 border-b border-border pb-4">
              <User className="w-4 h-4 text-primary" /> Autoria
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                Nome do Autor
              </label>
              <Input
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
                className="bg-background border-border"
              />
            </div>
          </div>

          {/* Card: Imagem */}
          <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 border-b border-border pb-4">
              <ImageIcon className="w-4 h-4 text-primary" /> Capa
            </h3>
            <Input
              value={formData.featuredImage}
              onChange={(e) =>
                setFormData({ ...formData, featuredImage: e.target.value })
              }
              placeholder="https://..."
              className="bg-background border-border text-xs"
            />
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border bg-muted/20 flex items-center justify-center">
              {formData.featuredImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={formData.featuredImage}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => (e.currentTarget.src = '')}
                />
              ) : (
                <ImageIcon className="text-muted-foreground/30 w-10 h-10" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
