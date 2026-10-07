// Cabeçalho, menu e rodapé copiados do site principal (Worker site-vladimirhersen)
// para o blog ficar com a mesma cara. Se o menu do site mudar, atualize aqui também.

export const topAnnouncementBar = () => `
  <div class="bg-brand-night text-brand-canvas text-xs py-2 px-4 text-center border-b border-brand-night/80 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
    <span>🌿 <strong>Teste gratuito:</strong> descubra em 2 minutos o seu nível de sobrecarga</span>
    <a href="https://avalie-ieh.vladihersen.workers.dev" target="_blank" rel="noopener" class="underline font-semibold text-brand-sand hover:text-white transition-colors ml-1">
      Fazer agora →
    </a>
  </div>
`;

export const navBar = (currentPath, navBg = '#F8F9F9') => `
  ${topAnnouncementBar()}
  <header class="sticky top-0 z-50 backdrop-blur-md bg-[${navBg}]/95 border-b border-brand-border/60">
    <div class="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-x-6">
      <a href="/" class="group flex flex-col shrink-0 whitespace-nowrap">
        <span class="font-serif text-xl sm:text-2xl tracking-wider text-brand-night group-hover:text-brand-teal transition-colors font-bold">VLADIMIR HERSEN</span>
        <span class="text-[9px] sm:text-[10px] tracking-[0.2em] text-brand-sage uppercase font-medium">Curadoria de Evolução Humana</span>
      </a>

      <!-- MENU DESKTOP -->
      <nav class="hidden xl:flex items-center gap-x-3 text-[13px] font-medium text-brand-night whitespace-nowrap">
        <a href="/mentoria-leveza-de-viver/" class="transition-colors hover:text-brand-teal ${currentPath === '/mentoria-leveza-de-viver' ? 'text-brand-teal font-semibold' : ''}">Mentoria</a>
        <a href="/jornada-respirar-bem/" class="transition-colors hover:text-brand-teal ${currentPath === '/jornada-respirar-bem' ? 'text-brand-teal font-semibold' : ''}">Respirar Bem</a>
        <a href="/tibetana-de-rejuvenescimento/" class="transition-colors hover:text-brand-terracota ${currentPath === '/tibetana-de-rejuvenescimento' ? 'text-brand-terracota font-semibold' : ''}">Ritos Tibetanos</a>
        <a href="/acupuntura/" class="transition-colors hover:text-brand-teal ${currentPath === '/acupuntura' ? 'text-brand-teal font-semibold' : ''}">Acupuntura</a>
        <a href="/aplicativos/" class="transition-colors hover:text-brand-teal ${currentPath === '/aplicativos' ? 'text-brand-teal font-semibold' : ''}">Aplicativos</a>
        <a href="/trilogia-de-ebooks/" class="transition-colors hover:text-brand-teal ${currentPath === '/trilogia-de-ebooks' ? 'text-brand-teal font-semibold' : ''}">E-books de Autoconhecimento</a>
        <a href="/ebooks-respiracao/" class="transition-colors hover:text-brand-teal ${currentPath === '/ebooks-respiracao' ? 'text-brand-teal font-semibold' : ''}">E-books de Respiração</a>
        <a href="/blog/" class="transition-colors hover:text-brand-teal ${currentPath === '/blog' ? 'text-brand-teal font-semibold' : ''}">Blog</a>

        <a href="https://dashboard.kiwify.com.br/" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-4 py-2 border border-brand-sand bg-white text-brand-night hover:bg-brand-teal hover:text-white rounded text-xs tracking-wider uppercase font-semibold transition-all ml-2 shadow-sm">
          <span>Área do Aluno</span>
        </a>
      </nav>

      <!-- CELULAR -->
      <div class="flex items-center gap-2 xl:hidden">
        <a href="https://dashboard.kiwify.com.br/" target="_blank" rel="noopener" class="px-3 py-1.5 rounded text-[11px] tracking-wider uppercase bg-brand-teal text-white font-semibold">
          Aluno
        </a>
        <button onclick="toggleMobileMenu()" class="p-2 rounded text-brand-night hover:text-brand-teal focus:outline-none transition-colors" aria-label="Abrir Menu">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- GAVETA CELULAR -->
    <div id="mobile-drawer" class="hidden xl:hidden bg-white border-b border-brand-border px-6 py-6 shadow-xl">
      <div class="flex flex-col space-y-4 text-sm font-medium text-brand-night">
        <a href="/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Início</a>
        <a href="/#atividades-principais" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Atividades & Cursos</a>
        <a href="/mentoria-leveza-de-viver/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Mentoria Leveza de Viver</a>
        <a href="/jornada-respirar-bem/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Jornada Respirar Bem</a>
        <a href="/tibetana-de-rejuvenescimento/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-terracota">Ritos Tibetanos (curso gravado)</a>
        <a href="/acupuntura/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Acupuntura Domiciliar</a>
        <a href="/aplicativos/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 text-brand-teal font-semibold">Aplicativos (Tecnologias de Consciência)</a>
        <a href="/trilogia-de-ebooks/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">E-books de Autoconhecimento (A Revolução de Ser Feliz)</a>
        <a href="/ebooks-respiracao/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">E-books de Respiração</a>
        <a href="/#sobre-mim" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Sobre Vladimir Hersen</a>
        <a href="/blog/" onclick="toggleMobileMenu()" class="py-1 border-b border-brand-border/60 hover:text-brand-teal">Blog · Palavras para Respirar</a>
        <div class="pt-2">
          <a href="https://dashboard.kiwify.com.br/" target="_blank" rel="noopener" class="block w-full py-3 rounded bg-brand-teal text-white text-center text-xs tracking-wider uppercase font-semibold">
            Entrar na Área do Aluno ➔
          </a>
        </div>
      </div>
    </div>
  </header>
`;

export const footer = () => `
  <footer class="bg-brand-night text-brand-canvas/80 border-t border-brand-border/20 pt-16 pb-12 mt-20">
    <div class="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
      <div class="md:col-span-2">
        <h3 class="font-serif text-2xl tracking-wide text-white font-bold">VLADIMIR HERSEN</h3>
        <p class="mt-3 text-sm leading-relaxed max-w-md text-brand-canvas/70 font-light">
          Acupunturista desde 1990, com atendimento em domicílio no Rio de Janeiro. Professor de yoga, meditação e respiração desde 1996, aluno por décadas do Professor Hermógenes. Depois de três infartos, segue ensinando aquilo que o manteve em paz.
        </p>
        <p class="mt-6 text-xs text-brand-sand">
          Valores que guiam este trabalho: Verdade, Retidão, Paz, Amor e Não Violência
        </p>
      </div>
      <div>
        <h4 class="text-xs uppercase tracking-[0.2em] font-semibold text-white">Cursos e atividades</h4>
        <ul class="mt-4 space-y-2.5 text-sm font-light">
          <li><a href="https://dashboard.kiwify.com.br/" target="_blank" rel="noopener" class="text-brand-sand font-semibold hover:underline">➔ Entrar na Área do Aluno</a></li>
          <li><a href="/jornada-respirar-bem/" class="hover:text-brand-sand transition-colors">Jornada Respirar Bem (curso gravado, 16 aulas)</a></li>
          <li><a href="/tibetana-de-rejuvenescimento/" class="hover:text-brand-sand transition-colors">Ritos Tibetanos (curso gravado, 21 dias)</a></li>
          <li><a href="/mentoria-leveza-de-viver/" class="hover:text-brand-sand transition-colors">Mentoria Leveza de Viver (ao vivo)</a></li>
          <li><a href="/acupuntura/" class="hover:text-brand-sand transition-colors">Acupuntura em Domicílio (RJ)</a></li>
          <li><a href="/aplicativos/" class="hover:text-brand-sand transition-colors">Aplicativos (Tecnologias de Consciência)</a></li>
          <li><a href="/trilogia-de-ebooks/" class="hover:text-brand-sand transition-colors">E-books de Autoconhecimento</a></li>
          <li><a href="/ebooks-respiracao/" class="hover:text-brand-sand transition-colors">E-books de Respiração</a></li>
          <li><a href="/blog/" class="hover:text-brand-sand transition-colors">Blog · Palavras para Respirar</a></li>
        </ul>
      </div>
      <div>
        <h4 class="text-xs uppercase tracking-[0.2em] font-semibold text-white">Acupuntura Domiciliar</h4>
        <ul class="mt-4 space-y-2.5 text-sm font-light">
          <li><span class="text-white font-medium">Barra da Tijuca, Recreio, São Conrado, Joá e adjacências</span></li>
          <li><span class="text-brand-canvas/60">Rio de Janeiro — RJ</span></li>
          <li><a href="https://wa.me/5521991245097?text=Olá+Vladimir+Hersen,+gostaria+de+informações+sobre+o+atendimento+personalizado+de+Acupuntura+Domiciliar+na+Barra+da+Tijuca." target="_blank" rel="noopener" class="hover:text-brand-sand transition-colors">WhatsApp: (21) 99124-5097</a></li>
          <li><a href="mailto:vladihersen@gmail.com" class="hover:text-brand-sand transition-colors">vladihersen@gmail.com</a></li>
        </ul>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-6 mt-10 pt-6 border-t border-white/10 text-[11px] text-brand-canvas/50 leading-relaxed font-light">
      <p>
        <strong>Aviso importante:</strong> os cursos, a mentoria, os aplicativos e os conteúdos deste site têm finalidade educativa e de desenvolvimento pessoal. Não constituem nem substituem acompanhamento médico, diagnóstico clínico, tratamentos psicológicos ou psiquiátricos. Relatos de alunos refletem experiências individuais e resultados podem variar de pessoa para pessoa.
      </p>
      <div class="flex flex-col md:flex-row items-center justify-between mt-4 text-brand-canvas/40">
        <p>&copy; ${new Date().getFullYear()} Vladimir Hersen · vladimirhersen.com.br · Todos os direitos reservados.</p>
        
      </div>
    </div>
  </footer>
`;

// ============================================================================
// PÁGINA 1: HOME PRINCIPAL
