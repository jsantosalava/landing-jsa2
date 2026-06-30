(function () {
  "use strict";

  var EcFacturaPlanConfig = {
    apiBase: "https://api.ecfactura.com/api/v1/public/plans",
    proxyBase: "/api/plans",
    cacheTtlMs: 24 * 60 * 60 * 1000,
    types: {
      invoicing: {
        label: "Facturacion electronica",
        emptyText: "No hay planes de facturacion disponibles en este momento."
      },
      store: {
        label: "Tienda y punto de venta",
        emptyText: "No hay planes de tienda disponibles en este momento."
      }
    }
  };

  var EcFacturaPlansCache = {
    key: function (type) {
      return "jsa_ecfactura_plans_" + type;
    },

    get: function (type) {
      try {
        var raw = localStorage.getItem(this.key(type));
        var cached = raw ? JSON.parse(raw) : null;

        if (!cached || !cached.savedAt || !Array.isArray(cached.plans)) {
          return null;
        }

        return cached;
      } catch (error) {
        return null;
      }
    },

    isFresh: function (cached) {
      return cached && Date.now() - cached.savedAt < EcFacturaPlanConfig.cacheTtlMs;
    },

    set: function (type, plans, remoteUpdatedAt) {
      var payload = {
        plans: plans,
        savedAt: Date.now(),
        remoteUpdatedAt: remoteUpdatedAt || null
      };

      try {
        localStorage.setItem(this.key(type), JSON.stringify(payload));
      } catch (error) {
        return payload;
      }

      return payload;
    }
  };

  var EcFacturaPlansApi = {
    buildProxyUrl: function (type) {
      return EcFacturaPlanConfig.proxyBase + "?type=" + encodeURIComponent(type);
    },

    buildDirectUrl: function (type) {
      return EcFacturaPlanConfig.apiBase + "?type=" + encodeURIComponent(type);
    },

    fetchJson: function (url) {
      return fetch(url, {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        return response.json();
      });
    },

    normalizePlans: function (payload) {
      if (Array.isArray(payload)) {
        return payload;
      }

      if (payload && Array.isArray(payload.value)) {
        return payload.value;
      }

      if (payload && Array.isArray(payload.data)) {
        return payload.data;
      }

      if (payload && payload.data && Array.isArray(payload.data.value)) {
        return payload.data.value;
      }

      return [];
    },

    getRemoteDate: function (payload) {
      var candidates = [
        payload && payload.updated_at,
        payload && payload.updatedAt,
        payload && payload.last_update,
        payload && payload.lastUpdate,
        payload && payload.generated_at,
        payload && payload.generatedAt
      ];

      for (var index = 0; index < candidates.length; index += 1) {
        if (candidates[index]) {
          return candidates[index];
        }
      }

      return null;
    },

    getPlans: function (type) {
      var self = this;

      return self.fetchJson(self.buildProxyUrl(type))
        .catch(function () {
          return self.fetchJson(self.buildDirectUrl(type));
        })
        .then(function (payload) {
          return {
            plans: self.normalizePlans(payload),
            remoteUpdatedAt: self.getRemoteDate(payload)
          };
        });
    }
  };

  var EcFacturaPlansRenderer = {
    escapeHtml: function (value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    formatMoney: function (value) {
      var amount = Number(value || 0);

      return new Intl.NumberFormat("es-EC", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
      }).format(amount);
    },

    formatDate: function (value) {
      var date = value ? new Date(value) : new Date();

      if (Number.isNaN(date.getTime())) {
        date = new Date();
      }

      return new Intl.DateTimeFormat("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    },

    extractBenefit: function (benefits, pattern, fallback) {
      var list = Array.isArray(benefits) ? benefits : [];
      var found = list.find(function (item) {
        return pattern.test(String(item));
      });

      return found || fallback;
    },

    getDocuments: function (plan) {
      return this.extractBenefit(
        plan.benefits,
        /(documentos?|facturas?|comprobantes?|ventas)/i,
        "Segun plan"
      );
    },

    getUsers: function (plan) {
      return this.extractBenefit(plan.benefits, /usuarios?/i, "Segun plan");
    },

    getVigencia: function (plan) {
      if (Number(plan.price_yearly || 0) > 0) {
        return "Anual";
      }

      if (Number(plan.price_monthly || 0) > 0) {
        return "Mensual";
      }

      return "Sin costo";
    },

    getPrice: function (plan) {
      var yearly = Number(plan.price_yearly || 0);
      var monthly = Number(plan.price_monthly || 0);

      if (yearly > 0) {
        return {
          amount: this.formatMoney(yearly),
          period: "/ año",
          detail: monthly > 0 ? this.formatMoney(monthly) + " / mes" : ""
        };
      }

      return {
        amount: this.formatMoney(monthly),
        period: monthly > 0 ? "/ mes" : "",
        detail: monthly > 0 ? "" : "Plan gratuito"
      };
    },

    renderSkeleton: function (section) {
      var grid = section.querySelector("[data-plans-grid]");

      grid.innerHTML = Array.from({ length: 3 }).map(function () {
        return [
          '<article class="plan-card loading">',
          '<div class="skeleton-line short"></div>',
          '<div class="skeleton-line medium"></div>',
          '<div class="skeleton-line"></div>',
          '<div class="skeleton-line short"></div>',
          '</article>'
        ].join("");
      }).join("");
    },

    renderStatus: function (section, cached, customMessage) {
      var status = section.querySelector("[data-plans-status]");
      var message = customMessage || "Planes actualizados automáticamente desde EcFactura";
      var dateSource = cached && (cached.remoteUpdatedAt || cached.savedAt);

      if (dateSource) {
        message += " · Última actualización: " + this.formatDate(dateSource);
      }

      status.textContent = message;
    },

    renderError: function (section) {
      var grid = section.querySelector("[data-plans-grid]");
      grid.innerHTML = '<div class="plans-error">No fue posible obtener los planes actualizados en este momento.</div>';
      this.renderStatus(section, null, "Planes actualizados automáticamente desde EcFactura");
    },

    renderPlans: function (section, type, plans, cached) {
      var grid = section.querySelector("[data-plans-grid]");
      var config = EcFacturaPlanConfig.types[type] || {};

      if (!plans.length) {
        grid.innerHTML = '<div class="plans-error">' + this.escapeHtml(config.emptyText || "No hay planes disponibles.") + '</div>';
        this.renderStatus(section, cached);
        return;
      }

      grid.innerHTML = plans.map(this.renderPlanCard.bind(this, type)).join("");
      this.renderStatus(section, cached);
    },

    renderPlanCard: function (type, plan) {
      var benefits = Array.isArray(plan.benefits) ? plan.benefits : [];
      var price = this.getPrice(plan);
      var discount = Number(plan.yearly_discount_pct || 0);
      var meta = type === "store"
        ? [
            ["Usuarios", this.getUsers(plan)],
            ["Beneficio", this.extractBenefit(benefits, /(inventario|ventas|productos|reportes)/i, "Punto de venta")],
            ["Vigencia", this.getVigencia(plan)]
          ]
        : [
            ["Documentos", this.getDocuments(plan)],
            ["Descuento", discount > 0 ? discount + "% anual" : "Sin descuento"],
            ["Vigencia", this.getVigencia(plan)]
          ];

      return [
        '<article class="plan-card' + (plan.highlight ? ' highlight' : '') + '">',
        '<span class="badge">' + this.escapeHtml(plan.highlight ? "Popular" : (EcFacturaPlanConfig.types[type] || {}).label || "Plan") + '</span>',
        '<h3>' + this.escapeHtml(plan.name || "Plan") + '</h3>',
        '<p>' + this.escapeHtml(plan.tagline || "Plan disponible en EcFactura.") + '</p>',
        '<div class="price">' + this.escapeHtml(price.amount) + ' <span>' + this.escapeHtml(price.period) + '</span></div>',
        price.detail ? '<p class="plan-note">' + this.escapeHtml(price.detail) + '</p>' : "",
        '<div class="plan-meta">' + meta.map(function (item) {
          return [
            '<div class="plan-meta-item">',
            '<span class="plan-meta-label">' + EcFacturaPlansRenderer.escapeHtml(item[0]) + '</span>',
            '<span class="plan-meta-value">' + EcFacturaPlansRenderer.escapeHtml(item[1]) + '</span>',
            '</div>'
          ].join("");
        }).join("") + '</div>',
        benefits.length ? '<ul class="plan-benefits">' + benefits.map(function (benefit) {
          return '<li>' + EcFacturaPlansRenderer.escapeHtml(benefit) + '</li>';
        }).join("") + '</ul>' : "",
        '<div class="plan-note">Precios sin IVA</div>',
        '</article>'
      ].join("");
    }
  };

  function EcFacturaPlans(root) {
    this.root = root;
  }

  EcFacturaPlans.prototype.init = function () {
    var self = this;
    var sections = self.root.querySelectorAll("[data-ecfactura-plans]");

    sections.forEach(function (section) {
      self.loadSection(section);
    });
  };

  EcFacturaPlans.prototype.loadSection = function (section) {
    var type = section.getAttribute("data-ecfactura-plans");
    var cached = EcFacturaPlansCache.get(type);

    if (EcFacturaPlansCache.isFresh(cached)) {
      EcFacturaPlansRenderer.renderPlans(section, type, cached.plans, cached);
      return;
    }

    EcFacturaPlansRenderer.renderSkeleton(section);

    EcFacturaPlansApi.getPlans(type)
      .then(function (result) {
        var cachedResult = EcFacturaPlansCache.set(type, result.plans, result.remoteUpdatedAt);
        EcFacturaPlansRenderer.renderPlans(section, type, result.plans, cachedResult);
      })
      .catch(function () {
        if (cached && cached.plans && cached.plans.length) {
          EcFacturaPlansRenderer.renderPlans(
            section,
            type,
            cached.plans,
            cached
          );
          EcFacturaPlansRenderer.renderStatus(
            section,
            cached,
            "No fue posible obtener los planes actualizados en este momento."
          );
          return;
        }

        EcFacturaPlansRenderer.renderError(section);
      });
  };

  window.EcFacturaPlans = EcFacturaPlans;

  document.addEventListener("DOMContentLoaded", function () {
    new EcFacturaPlans(document).init();
  });
}());
