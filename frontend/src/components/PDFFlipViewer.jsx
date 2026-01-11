import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from './ui/button';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFFlipViewer({ isOpen, onClose, pdfUrl }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayPage, setDisplayPage] = useState(1);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  const changePage = (offset) => {
    if (isTransitioning) return;
    
    const newPage = pageNumber + offset;
    if (newPage < 1 || newPage > numPages) return;
    
    setIsTransitioning(true);
    
    // Start slide out animation
    setTimeout(() => {
      setDisplayPage(newPage);
      setPageNumber(newPage);
    }, 250);
    
    // End transition
    setTimeout(() => {
      setIsTransitioning(false);
    }, 500);
  };

  const previousPage = () => {
    changePage(-1);
  };

  const nextPage = () => {
    changePage(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-card border border-border hover:bg-muted flex items-center justify-center transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-5 h-5 text-foreground" />
      </button>

      {/* Download Button */}
      <a
        href={pdfUrl}
        download="Guia-del-Corredor-BYSD-2026.pdf"
        className="absolute top-4 right-20 z-10"
      >
        <Button
          variant="outline"
          size="sm"
          className="bg-card border-border hover:bg-muted"
        >
          <Download className="w-4 h-4 mr-2" />
          Descargar
        </Button>
      </a>

      {/* Main Content */}
      <div className="w-full h-full max-w-4xl flex flex-col items-center justify-center">
        {/* PDF Viewer with Flip Animation */}
        <div className="relative bg-card border border-border rounded-lg shadow-strong overflow-hidden">
          <div className={`pdf-page-wrapper ${isTransitioning ? 'transitioning' : ''}`}>
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-[600px] w-[450px]">
                  <div className="text-muted-foreground">Cargando guía del corredor...</div>
                </div>
              }
            >
              <Page
                pageNumber={displayPage}
                width={450}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="pdf-page"
                loading=""
              />
            </Document>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            variant="outline"
            size="icon"
            className="w-12 h-12 bg-card border-border hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <div className="px-6 py-2 bg-card border border-border rounded-lg">
            <p className="text-sm font-medium text-foreground">
              Página {pageNumber} de {numPages || '--'}
            </p>
          </div>

          <Button
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            variant="outline"
            size="icon"
            className="w-12 h-12 bg-card border-border hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* CSS for flip animation */}
      <style jsx>{`
        .pdf-page-wrapper {
          transition: all 0.25s ease-out;
          opacity: 1;
        }
        
        .pdf-page-wrapper.transitioning {
          animation: pageSlide 0.5s ease-in-out;
        }
        
        @keyframes pageSlide {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          40% {
            transform: translateX(-40px);
            opacity: 0;
          }
          60% {
            transform: translateX(40px);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .pdf-page canvas {
          max-width: 100%;
          height: auto !important;
        }
      `}</style>
    </div>
  );
}
