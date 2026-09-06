"""Reduce the manifold implicit sculpts with quadric-error edge collapse."""
import json
from pathlib import Path
import numpy as np
import trimesh
import fast_simplification

for name, target in [('ferret',5200),('goose',2200)]:
    raw=json.loads(Path(f'output/model-build/{name}-raw.json').read_text())
    vertices=np.asarray(raw['positions'],dtype=np.float64).reshape(-1,3)
    faces=np.asarray(raw['indices'],dtype=np.int32).reshape(-1,3)
    source=trimesh.Trimesh(vertices,faces,process=True)
    source.merge_vertices(digits_vertex=5)
    source.update_faces(source.nondegenerate_faces(height=1e-7))
    source.update_faces(source.unique_faces())
    source.remove_unreferenced_vertices()
    assert source.is_watertight and source.euler_number==2, f'{name} raw surface must be a closed, hole-free sculpt'
    weighted=source.vertices.copy()
    if name=='ferret':
        # Increase geometric importance around the facial rig before simplification.
        y=weighted[:,1].copy()
        t=np.clip((y-1.55)/.20,0,1); scale=1+.60*t*t*(3-2*t)
        weighted[:,0]*=scale
        weighted[:,2]=1.15+(weighted[:,2]-1.15)*scale
        weighted[:,1]=np.where(y>1.55,1.55+(y-1.55)*1.65,y)
    for aggression in [5,4,3,2]:
        points,triangles=fast_simplification.simplify(weighted,source.faces,target_count=target,agg=aggression)
        if name=='ferret':
            y=np.where(points[:,1]>1.55,1.55+(points[:,1]-1.55)/1.65,points[:,1])
            t=np.clip((y-1.55)/.20,0,1);scale=1+.60*t*t*(3-2*t)
            points[:,0]/=scale;points[:,2]=1.15+(points[:,2]-1.15)/scale;points[:,1]=y
        mesh=trimesh.Trimesh(points,triangles,process=True)
        mesh.update_faces(mesh.nondegenerate_faces(height=1e-8));mesh.update_faces(mesh.unique_faces());mesh.remove_unreferenced_vertices()
        if mesh.is_watertight and mesh.euler_number==2:break
    assert mesh.is_watertight, f'{name} must remain watertight'
    assert mesh.euler_number==2, f'{name} must have a single closed, hole-free surface'
    result={'positions':np.round(mesh.vertices,6).ravel().tolist(),'indices':mesh.faces.ravel().tolist(),'bounds':{'min':mesh.bounds[0].tolist(),'max':mesh.bounds[1].tolist()}}
    Path(f'src/models/{name}.json').write_text(json.dumps(result,separators=(',',':')))
    print(f'{name}: {len(mesh.vertices)} vertices / {len(mesh.faces)} triangles; watertight, Euler 2')
