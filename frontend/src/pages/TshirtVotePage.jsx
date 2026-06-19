import React, { useState, useEffect, useCallback } from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '../components/ui/carousel';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Shirt, Check, Trophy, Loader2, User, Vote } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Anonymous per-device voter id (persists in localStorage, allows changing the vote)
const getVoterId = () => {
  let id = localStorage.getItem('tshirt_voter_id');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem('tshirt_voter_id', id);
  }
  return id;
};

const RANK_COLORS = ['bg-amber-400', 'bg-gray-300', 'bg-orange-400'];

export default function TshirtVotePage() {
  const [designs, setDesigns] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(null);
  const voterId = getVoterId();

  const loadDesigns = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tshirt/designs?voter_id=${encodeURIComponent(voterId)}`);
      const data = await res.json();
      setDesigns(data.designs || []);
      setMyVote(data.my_vote || null);
      setTotalVotes(data.total_votes || 0);
    } catch {
      toast.error('Error al cargar los diseños');
    } finally {
      setLoading(false);
    }
  }, [voterId]);

  useEffect(() => { loadDesigns(); }, [loadDesigns]);

  const handleVote = async (designId) => {
    if (myVote === designId) return;
    setVoting(designId);
    try {
      const res = await fetch(`${API_URL}/api/tshirt/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: voterId, design_id: designId }),
      });
      if (res.ok) {
        toast.success(myVote ? '¡Voto actualizado!' : '¡Gracias por votar!');
        await loadDesigns();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.detail || 'No se pudo registrar el voto');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setVoting(null);
    }
  };

  const ranking = [...designs].sort((a, b) => b.vote_count - a.vote_count);
  const maxVotes = Math.max(1, ...designs.map(d => d.vote_count));

  return (
    <div className="min-h-screen bg-background pt-28 pb-20" data-testid="tshirt-vote-page">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shirt className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-foreground mb-3">Vota la Camiseta</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Estas son las propuestas de camiseta para el evento. Vota por tu favorita —
            puedes cambiar tu decisión en cualquier momento. Solo cuenta un voto por persona.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>
        ) : designs.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Shirt className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Aún no hay diseños publicados. ¡Vuelve pronto!</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Carousel */}
            <div className="px-12 mb-12">
              <Carousel opts={{ loop: true }} data-testid="tshirt-carousel">
                <CarouselContent>
                  {designs.map((d) => {
                    const isMyVote = myVote === d.id;
                    return (
                      <CarouselItem key={d.id}>
                        <Card className={`overflow-hidden transition-all ${isMyVote ? 'ring-2 ring-primary' : ''}`}>
                          <div className="bg-neutral-900 flex items-center justify-center p-4">
                            <img
                              src={`${API_URL}${d.image_url}`}
                              alt={d.name || 'Diseño de camiseta'}
                              className="max-h-[460px] w-auto object-contain"
                              data-testid={`design-image-${d.id}`}
                            />
                          </div>
                          <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                {d.name && <h3 className="font-display text-2xl text-foreground">{d.name}</h3>}
                                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                                  <User className="w-4 h-4" />
                                  Postulada por <span className="font-semibold text-foreground">{d.proposed_by || '—'}</span>
                                </p>
                                <p className="text-sm text-primary font-medium mt-2 flex items-center gap-1.5">
                                  <Vote className="w-4 h-4" />
                                  {d.vote_count} {d.vote_count === 1 ? 'voto' : 'votos'}
                                </p>
                              </div>
                              <Button
                                onClick={() => handleVote(d.id)}
                                disabled={voting === d.id}
                                className={isMyVote
                                  ? 'bg-green-600 hover:bg-green-600 cursor-default'
                                  : 'bg-primary hover:bg-primary/90'}
                                data-testid={`vote-btn-${d.id}`}
                              >
                                {voting === d.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : isMyVote ? (
                                  <Check className="w-4 h-4 mr-2" />
                                ) : (
                                  <Vote className="w-4 h-4 mr-2" />
                                )}
                                {isMyVote ? 'Tu voto' : 'Votar por esta'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious data-testid="carousel-prev" />
                <CarouselNext data-testid="carousel-next" />
              </Carousel>
            </div>

            {/* Ranking chart */}
            <Card data-testid="ranking-chart">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-2xl text-foreground flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-primary" />
                    Ranking de votos
                  </h2>
                  <span className="text-sm text-muted-foreground">{totalVotes} {totalVotes === 1 ? 'voto total' : 'votos totales'}</span>
                </div>
                <div className="space-y-4">
                  {ranking.map((d, i) => (
                    <div key={d.id} className="flex items-center gap-3" data-testid={`ranking-row-${d.id}`}>
                      <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-neutral-900 ${RANK_COLORS[i] || 'bg-muted text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {d.name || 'Diseño'} <span className="text-muted-foreground font-normal">· {d.proposed_by}</span>
                          </span>
                          <span className="text-sm font-semibold text-foreground ml-2">{d.vote_count}</span>
                        </div>
                        <div className="h-3 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${(d.vote_count / maxVotes) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
